-- Additive beta foundation. Existing rows are preserved and become private.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
create table private.settings(key text primary key,value text not null);
insert into private.settings values ('member_limit','20'),('bottle_limit','25'),('daily_cutouts','10'),('storage_limit','800000000');
create table private.members(
 user_id uuid primary key references auth.users(id) on delete cascade,
 is_admin boolean not null default false,suspended boolean not null default false,created_at timestamptz not null default now()
);
create table private.invites(
 id uuid primary key default gen_random_uuid(),code_hash text unique not null,email text,
 purpose text not null default 'join' check(purpose in('join','recovery')),target_user uuid,
 created_by uuid,expires_at timestamptz not null default now()+interval '7 days',redeemed_by uuid,
 claim_id uuid,claim_until timestamptz,created_at timestamptz not null default now()
);
alter table private.members enable row level security;
alter table private.settings enable row level security;
alter table private.invites enable row level security;
-- Preserve tombstones/history after deleting the corresponding auth identity.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add column shelf_public boolean not null default false;
alter table public.profiles add column deleted_at timestamptz;
create table public.shelves(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),
 name text not null check(length(trim(name)) between 1 and 50),position integer not null default 0,created_at timestamptz not null default now()
);
create index shelves_owner_idx on public.shelves(owner_id,position);
alter table public.bottles add column shelf_id uuid references public.shelves(id);
alter table public.bottles add column position integer not null default 0;
alter table public.bottles add column condition text not null default 'good' check(condition in('new','excellent','good','fair'));
alter table public.bottles add column has_cap boolean not null default true;
alter table public.bottles add column has_box boolean not null default false;
alter table public.bottles add column original_path text;
alter table public.bottles add column condition_path text;
alter table public.bottles add column version integer not null default 1;
alter table public.bottles add column archived boolean not null default false;
alter table public.bottles add column suspended boolean not null default false;
alter table public.bottles add column updated_at timestamptz not null default now();
create index bottles_owner_idx on public.bottles(owner_id,shelf_id,position);
create index bottles_listing_idx on public.bottles(trade_available,created_at) where not archived and not suspended;
create table public.capture_jobs(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),
 status text not null default 'uploading' check(status in('uploading','queued','waking','processing','ready','failed','expired')),
 original_path text not null unique,cutout_path text not null unique,
 width integer,height integer,error text,attempts integer not null default 0,
 lease_id uuid,lease_until timestamptz,bottle_id uuid references public.bottles(id),
 draft jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index capture_owner_idx on public.capture_jobs(owner_id,created_at);
create index capture_recovery_idx on public.capture_jobs(status,lease_until) where bottle_id is null;
create table private.processing_attempts(job_id uuid not null,user_id uuid not null,created_at timestamptz not null default now());
create index processing_daily_idx on private.processing_attempts(user_id,created_at);
alter table private.processing_attempts enable row level security;
alter table public.trades drop constraint if exists trades_status_check;
alter table public.trades add constraint trades_status_check check(status in('proposed','in-progress','paused','complete','declined','cancelled','expired'));
alter table public.trades add column snapshot jsonb not null default '{}';
alter table public.trades add column expires_at timestamptz not null default now()+interval '7 days';
alter table public.trades add column cancel_by uuid[] not null default '{}';
alter table public.trades add column resume_by uuid[] not null default '{}';
alter table public.trades add column dispatched_by uuid[] not null default '{}';
alter table public.trades add column exchange jsonb not null default '{}';
create index trades_proposer_idx on public.trades(proposer_id,created_at desc);
create index trades_recipient_idx on public.trades(recipient_id,created_at desc);
create table public.trade_events(
 id uuid primary key default gen_random_uuid(),trade_id uuid not null references public.trades(id),
 actor_id uuid,kind text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
create index trade_events_trade_idx on public.trade_events(trade_id,created_at);
create table public.notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 trade_id uuid references public.trades(id),kind text not null,text text not null,read_at timestamptz,created_at timestamptz not null default now()
);
create index notifications_owner_idx on public.notifications(user_id,created_at desc);
create index messages_trade_idx on public.trade_messages(trade_id,sent_at);
create index blocks_reverse_idx on public.blocks(blocked_id,blocker_id);
alter table public.reports add column trade_id uuid references public.trades(id);
alter table public.reports add column admin_note text not null default '';
-- Never expose device tokens through a member profile projection.
create table private.device_tokens(user_id uuid primary key,token text);
insert into private.device_tokens select id,push_token from public.profiles where push_token is not null;
alter table private.device_tokens enable row level security;
alter table public.profiles drop column push_token;

create or replace function private.member_id(p_active boolean default true) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=auth.uid(); m private.members;
begin
 if me is null then raise exception 'Sign in to Fraggy.' using errcode='42501';end if;
 select * into m from private.members where user_id=me;
 if m.user_id is null then raise exception 'An active beta invitation is required.' using errcode='42501';end if;
 if p_active and m.suspended then raise exception 'Your account is restricted. Existing trades and support remain available.' using errcode='42501';end if;
 if auth.jwt()->>'session_id' is not null and not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=me) then
  raise exception 'Your session has ended. Sign in again.' using errcode='42501';
 end if;
 return me;
end $$;
create or replace function private.is_member() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.members m where m.user_id=auth.uid())
 and (auth.jwt()->>'session_id' is null or exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid()));
$$;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.is_member() and exists(select 1 from private.members where user_id=auth.uid() and is_admin and not suspended);
$$;
create or replace function private.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.blocks where (blocker_id=a and blocked_id=b) or(blocker_id=b and blocked_id=a));
$$;
create or replace function private.trade_party(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_member() and exists(select 1 from public.trades where id=t and auth.uid() in(proposer_id,recipient_id));
$$;
create or replace function private.can_read_bottle(bid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_member() and exists(
 select 1 from public.bottles b join public.profiles p on p.id=b.owner_id
 where b.id=bid and (b.owner_id=auth.uid() or
  (not b.archived and not b.suspended and p.deleted_at is null and not private.blocked(auth.uid(),b.owner_id)
   and exists(select 1 from private.members where user_id=b.owner_id and not suspended) and (b.trade_available or p.shelf_public))));
$$;
create or replace function private.can_read_media(path text) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_member() and (
 exists(select 1 from public.bottles b where path in(b.image_path,b.original_path,b.condition_path) and private.can_read_bottle(b.id))
 or exists(select 1 from public.capture_jobs j where j.owner_id=auth.uid() and j.bottle_id is null and j.status<>'expired' and path in(j.original_path,j.cutout_path))
 or exists(select 1 from public.trades t where auth.uid() in(t.proposer_id,t.recipient_id) and (
  path in(t.snapshot#>>'{offered,image_path}',t.snapshot#>>'{offered,original_path}',t.snapshot#>>'{offered,condition_path}',
   t.snapshot#>>'{requested,image_path}',t.snapshot#>>'{requested,original_path}',t.snapshot#>>'{requested,condition_path}')))
 or exists(select 1 from public.profiles p where p.avatar_url=path and p.deleted_at is null and not private.blocked(auth.uid(),p.id)));
$$;

-- Drop old broad policies and grants before installing beta access rules.
do $$ declare r record;begin
 for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' loop
  execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
 end loop;
 for r in select policyname from pg_policies where schemaname='storage' and tablename='objects' and (qual like '%cutouts%' or with_check like '%cutouts%') loop
  execute format('drop policy %I on storage.objects',r.policyname);
 end loop;
end $$;
revoke all on all tables in schema public from anon,authenticated;
revoke all on all tables in schema private from public,anon,authenticated;
grant all on all tables in schema public to service_role;
grant all on all tables in schema private to service_role;
do $$ declare t text;begin
 foreach t in array array['profiles','bottles','shelves','capture_jobs','trades','trade_messages','trade_events','notifications','blocks','reports','reviews','follows'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy beta_profiles on public.profiles for select to authenticated using((select private.is_member()) and (id=auth.uid() or(deleted_at is null and not private.blocked(auth.uid(),id))));
create policy beta_bottles on public.bottles for select to authenticated using(private.can_read_bottle(id));
create policy beta_shelves on public.shelves for select to authenticated using((select private.is_member()) and (owner_id=auth.uid() or exists(select 1 from public.profiles p where p.id=owner_id and p.shelf_public and not private.blocked(auth.uid(),owner_id))));
create policy beta_captures on public.capture_jobs for select to authenticated using((select private.is_member()) and owner_id=auth.uid());
create policy beta_trades on public.trades for select to authenticated using((select private.is_member()) and auth.uid() in(proposer_id,recipient_id));
create policy beta_messages on public.trade_messages for select to authenticated using(private.trade_party(trade_id));
create policy beta_events on public.trade_events for select to authenticated using(private.trade_party(trade_id));
create policy beta_notifications on public.notifications for select to authenticated using((select private.is_member()) and user_id=auth.uid());
create policy beta_blocks on public.blocks for select to authenticated using((select private.is_member()) and blocker_id=auth.uid());
create policy beta_reports on public.reports for select to authenticated using((select private.is_member()) and (reporter_id=auth.uid() or private.is_admin()));
create policy beta_reviews on public.reviews for select to authenticated using((select private.is_member()) and not private.blocked(auth.uid(),reviewee_id));
create policy beta_follows on public.follows for select to authenticated using((select private.is_member()) and follower_id=auth.uid());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('cutouts','cutouts',false,500000,array['image/png','image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=500000,allowed_mime_types=array['image/png','image/jpeg'];
create policy beta_media_read on storage.objects for select to authenticated using(bucket_id='cutouts' and private.can_read_media(name));
-- Uploads are exclusively short-lived signed tickets issued by the gateway.

create or replace function private.ensure_shelf(me uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid;begin
 select id into sid from public.shelves where owner_id=me order by position,created_at limit 1;
 if sid is null then insert into public.shelves(owner_id,name) values(me,'My collection') returning id into sid;end if;return sid;
end $$;
insert into public.shelves(owner_id,name) select id,'My collection' from public.profiles;
update public.bottles b set shelf_id=(select id from public.shelves where owner_id=b.owner_id order by created_at limit 1);

create or replace function public.update_profile(p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);begin
 if p_data ? 'handle' and not ((p_data->>'handle')~'^@[a-z0-9._]{3,30}$') then raise exception 'Use a handle like @collector (3–30 lowercase characters).';end if;
 if length(coalesce(p_data->>'name',''))>80 or length(coalesce(p_data->>'city',''))>80 or length(coalesce(p_data->>'bio',''))>160 then raise exception 'Profile text is too long.';end if;
 update public.profiles set handle=coalesce(p_data->>'handle',handle),name=coalesce(p_data->>'name',name),city=coalesce(p_data->>'city',city),bio=coalesce(p_data->>'bio',bio),shelf_public=coalesce((p_data->>'shelf_public')::boolean,shelf_public) where id=me;
end $$;
create or replace function public.save_shelf(p_name text,p_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();sid uuid:=p_id;begin
 if length(trim(p_name)) not between 1 and 50 then raise exception 'Shelf name must be 1–50 characters.';end if;
 if sid is null then insert into public.shelves(owner_id,name,position) values(me,trim(p_name),(select count(*) from public.shelves where owner_id=me)) returning id into sid;
 else update public.shelves set name=trim(p_name) where id=sid and owner_id=me;if not found then raise exception 'Shelf not found.';end if;end if;return sid;
end $$;
create or replace function public.move_bottle(p_bottle uuid,p_shelf uuid,p_position integer) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 perform 1 from public.shelves where id=p_shelf and owner_id=me;if not found then raise exception 'Choose your own shelf.';end if;
 perform 1 from public.bottles where id=p_bottle and owner_id=me and reserved_trade_id is null for update;if not found then raise exception 'This bottle is unavailable to move.';end if;
 update public.bottles set position=position+1 where owner_id=me and shelf_id=p_shelf and position>=greatest(0,p_position) and id<>p_bottle and reserved_trade_id is null;
 update public.bottles set shelf_id=p_shelf,position=greatest(0,p_position) where id=p_bottle;
end $$;
create or replace function public.edit_bottle(p_bottle uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(); b public.bottles;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 select * into b from public.bottles where id=p_bottle and owner_id=me for update;
 if length(p_data::text)>6000 then raise exception 'Bottle details are too long.';end if;
 if b.id is null or b.reserved_trade_id is not null then raise exception 'Reserved bottles cannot be edited or removed.';end if;
 update public.bottles set brand=coalesce(nullif(trim(p_data->>'brand'),''),brand),name=coalesce(nullif(trim(p_data->>'name'),''),name),size_ml=coalesce((p_data->>'size_ml')::integer,size_ml),remaining_percent=coalesce((p_data->>'remaining_percent')::integer,remaining_percent),condition=coalesce(p_data->>'condition',condition),has_cap=coalesce((p_data->>'has_cap')::boolean,has_cap),has_box=coalesce((p_data->>'has_box')::boolean,has_box),trade_available=coalesce((p_data->>'trade_available')::boolean,trade_available),methods=case when p_data?'methods' then array(select jsonb_array_elements_text(p_data->'methods')) else methods end,notes=coalesce(p_data->>'notes',notes),archived=coalesce((p_data->>'archived')::boolean,archived),version=version+1,updated_at=now() where id=p_bottle;
 update public.trades set status='expired',updated_at=now() where status='proposed' and p_bottle in(offered_bottle_id,requested_bottle_id);
end $$;

create or replace function public.create_capture() returns public.capture_jobs language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(); jid uuid:=gen_random_uuid(); j public.capture_jobs; used bigint;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-uploads'));
 if (select count(*) from public.bottles where owner_id=me and not archived)>=25 then raise exception 'The free beta supports 25 bottles per collector.';end if;
 if (select count(*) from public.capture_jobs where owner_id=me and created_at>=date_trunc('day',now()))>=10 then raise exception 'Daily photo limit reached. Try again tomorrow.';end if;
 select coalesce(sum((metadata->>'size')::bigint),0) into used from storage.objects where bucket_id='cutouts';
 if used+(select count(*)*1000000 from public.capture_jobs where bottle_id is null and status<>'expired')+1000000>800000000 then raise exception 'Beta photo storage is full. Existing shelves remain available.';end if;
 insert into public.capture_jobs(id,owner_id,original_path,cutout_path) values(jid,me,'captures/'||me||'/'||jid||'/original.jpg','captures/'||me||'/'||jid||'/cutout.png') returning * into j;return j;
end $$;
create or replace function public.start_capture(p_job uuid,p_draft jsonb default '{}') returns public.capture_jobs language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();j public.capture_jobs;begin
 select * into j from public.capture_jobs where id=p_job and owner_id=me for update;
 if j.id is null or j.bottle_id is not null or j.status='expired' then raise exception 'Capture not found.';end if;
 if length(p_draft::text)>6000 then raise exception 'Capture details are too long.';end if;
 if j.status='ready' then return j;end if;
 if j.status='processing' and j.lease_until>now() then return j;end if;
 if not exists(select 1 from storage.objects where bucket_id='cutouts' and name=j.original_path and (metadata->>'size')::bigint<=500000) then raise exception 'Upload the original photo first (500 KB maximum).';end if;
 update public.capture_jobs set status='queued',error=null,draft=p_draft,updated_at=now() where id=p_job returning * into j;return j;
end $$;
create or replace function public.save_capture_draft(p_job uuid,p_draft jsonb) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);begin
 if length(p_draft::text)>6000 then raise exception 'Capture details are too long.';end if;
 update public.capture_jobs set draft=p_draft,updated_at=now() where id=p_job and owner_id=me and bottle_id is null;
end $$;
create or replace function public.finalize_capture(p_job uuid,p_data jsonb,p_shelf uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();j public.capture_jobs;sid uuid;bid uuid;begin
 perform pg_advisory_xact_lock(hashtext(me::text));
 select * into j from public.capture_jobs where id=p_job and owner_id=me for update;
 if length(p_data::text)>6000 then raise exception 'Bottle details are too long.';end if;
 if j.id is null then raise exception 'Capture not found.';end if;
 if j.bottle_id is not null then return j.bottle_id;end if;
 if j.status<>'ready' then raise exception 'Your cutout is not ready yet.';end if;
 if (select count(*) from public.bottles where owner_id=me and not archived)>=25 then raise exception 'The beta bottle limit is 25.';end if;
 if not exists(select 1 from storage.objects where bucket_id='cutouts' and name=j.cutout_path and (metadata->>'size')::bigint<=500000) then raise exception 'The processed cutout is missing. Retry processing.';end if;
 sid:=coalesce(p_shelf,private.ensure_shelf(me));
 if not exists(select 1 from public.shelves where id=sid and owner_id=me) then raise exception 'Choose your own shelf.';end if;
 insert into public.bottles(owner_id,brand,name,size_ml,remaining_percent,image_path,image_kind,image_width,image_height,original_path,shelf_id,position,condition,has_cap,has_box,trade_available,methods,notes)
 values(me,trim(p_data->>'brand'),trim(p_data->>'name'),(p_data->>'size_ml')::integer,(p_data->>'remaining_percent')::integer,j.cutout_path,'cutout',j.width,j.height,j.original_path,sid,(select count(*) from public.bottles where owner_id=me and shelf_id=sid),coalesce(p_data->>'condition','good'),coalesce((p_data->>'has_cap')::boolean,true),coalesce((p_data->>'has_box')::boolean,false),coalesce((p_data->>'trade_available')::boolean,false),coalesce(array(select jsonb_array_elements_text(p_data->'methods')),array['local']),coalesce(p_data->>'notes','')) returning id into bid;
 update public.capture_jobs set bottle_id=bid,updated_at=now() where id=p_job;return bid;
end $$;

-- Service-only worker API. The random token is configured through the founder UI.
create or replace function public.configure_worker(p_url text) returns text language plpgsql security definer set search_path='' as $$
declare token text:=encode(extensions.gen_random_bytes(32),'hex');begin
 if not private.is_admin() then raise exception 'Founder access required.' using errcode='42501';end if;
 if p_url !~ '^https://[a-z0-9-]+[.]onrender[.]com$' then raise exception 'Use the HTTPS worker origin, without a path.';end if;
 insert into private.settings values('worker_url',p_url),('worker_token_hash',encode(extensions.digest(token,'sha256'),'hex')) on conflict(key) do update set value=excluded.value;
 return token;
end $$;
create or replace function public.worker_config() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('url',(select value from private.settings where key='worker_url'));
$$;
create or replace function public.claim_capture(p_job uuid,p_token text) returns public.capture_jobs language plpgsql security definer set search_path='' as $$
declare j public.capture_jobs;expected text;lease uuid:=gen_random_uuid();begin
 select value into expected from private.settings where key='worker_token_hash';
 if expected is null or expected<>encode(extensions.digest(p_token,'sha256'),'hex') then raise exception 'Worker authorization failed.' using errcode='42501';end if;
 select * into j from public.capture_jobs where id=p_job for update;
 if j.id is null or j.bottle_id is not null or j.status in('ready','expired') or(j.status='processing' and j.lease_until>now()) then return null;end if;
 perform pg_advisory_xact_lock(hashtext(j.owner_id::text));
 if (select count(*) from private.processing_attempts where user_id=j.owner_id and created_at>=date_trunc('day',now()))>=10 then
  update public.capture_jobs set status='failed',error='Daily processing limit reached. Try tomorrow.' where id=p_job;return null;
 end if;
 insert into private.processing_attempts(job_id,user_id) values(p_job,j.owner_id);
 update public.capture_jobs set status='processing',attempts=attempts+1,lease_id=lease,cutout_path='captures/'||owner_id||'/'||id||'/'||lease||'.png',lease_until=now()+interval '3 minutes',error=null,updated_at=now() where id=p_job returning * into j;return j;
end $$;
create or replace function public.complete_capture(p_job uuid,p_lease uuid,p_token text,p_width integer,p_height integer,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare expected text;begin
 select value into expected from private.settings where key='worker_token_hash';
 if expected is null or expected<>encode(extensions.digest(p_token,'sha256'),'hex') then raise exception 'Worker authorization failed.' using errcode='42501';end if;
 if p_error is null and (p_width<=0 or p_height<=0 or p_width>1600 or p_height>1600) then raise exception 'Invalid cutout dimensions.';end if;
 update public.capture_jobs set status=case when p_error is null then 'ready' else 'failed' end,width=p_width,height=p_height,error=left(p_error,500),lease_until=null,updated_at=now() where id=p_job and lease_id=p_lease and status='processing' and lease_until>now();return found;
end $$;

-- All routine access is explicit; default PUBLIC EXECUTE is removed.
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_member(),private.is_admin(),private.blocked(uuid,uuid),private.trade_party(uuid),private.can_read_bottle(uuid),private.can_read_media(text) to authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.update_profile(jsonb),public.save_shelf(text,uuid),public.move_bottle(uuid,uuid,integer),public.edit_bottle(uuid,jsonb),public.create_capture(),public.start_capture(uuid,jsonb),public.save_capture_draft(uuid,jsonb),public.finalize_capture(uuid,jsonb,uuid),public.configure_worker(text) to authenticated;
grant execute on all functions in schema public to service_role;
