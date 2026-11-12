-- Additive catalog metadata. Catalog matching does not verify authenticity.
alter table public.bottles add column fragrance jsonb;
create or replace function private.valid_fragrance(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text; d jsonb; a jsonb; x jsonb;begin
 if v is null or v='null'::jsonb then return true;end if;
 if jsonb_typeof(v)<>'object' or length(v::text)>9000 or v->>'source' not in('custom','scento') or v->>'source' is null then return false;end if;
 if not (v->'details' ?& array['brand','name','concentration','family','top','heart','base','unstructuredNotes']) then return false;end if;
 if jsonb_typeof(v->'details') is distinct from 'object' or jsonb_typeof(v->'overrides') is distinct from 'object' then return false;end if;
 if v->>'source'='custom' and (coalesce(v->'reference','null')<>'null'::jsonb or v->'overrides'<>'{}'::jsonb) then return false;end if;
 if v->>'source'='scento' then
  if jsonb_typeof(v->'reference') is distinct from 'object' or v#>>'{reference,provider}' is distinct from 'scento' or coalesce(v#>>'{reference,id}','') !~ '^[a-zA-Z0-9][a-zA-Z0-9-]{0,159}$' or coalesce(v#>>'{reference,sourceUrl}','') !~ '^https://(www[.])?scento[.]com/(en/)?perfumes/[a-zA-Z0-9][a-zA-Z0-9-]{0,159}/?$' then return false;end if;
 end if;
 foreach d in array array[v->'details',v->'overrides'] loop
  for k,x in select * from jsonb_each(d) loop
   if k in('brand','name','concentration','family') then if jsonb_typeof(x) not in('string','null') or length(x::text)>202 then return false;end if;
   elsif k in('top','heart','base','unstructuredNotes') then
    if jsonb_typeof(x)<>'array' or jsonb_array_length(x)>24 then return false;end if;
    for a in select * from jsonb_array_elements(x) loop if jsonb_typeof(a)<>'string' or length(a::text)>502 then return false;end if;end loop;
   else return false;end if;
  end loop;
 end loop;
 if length(trim(coalesce(v#>>'{details,brand}','')))=0 or length(trim(coalesce(v#>>'{details,name}','')))=0 then return false;end if;
 return true;
end $$;
alter table public.bottles add constraint valid_fragrance check(private.valid_fragrance(fragrance));
-- An invoker CHECK helper only validates its argument, never reads privileged rows.
grant execute on function private.valid_fragrance(jsonb) to authenticated;
create table public.wishlist(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,
 identity text not null,fragrance jsonb not null check(private.valid_fragrance(fragrance)),created_at timestamptz not null default now(),unique(owner_id,identity)
);
alter table public.wishlist enable row level security;
create policy wishlist_own on public.wishlist for select to authenticated using(owner_id=(select auth.uid()) and private.is_member());
grant select on public.wishlist to authenticated;
grant all on public.wishlist to service_role;
create function public.save_wish(p_fragrance jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();ident text;result uuid;begin
 if not private.valid_fragrance(p_fragrance) then raise exception 'Check your fragrance details.';end if;
 perform pg_advisory_xact_lock(hashtext(me::text));
 ident:=case when p_fragrance->>'source'='scento' then 'scento:'||(p_fragrance#>>'{reference,id}') else 'custom:'||lower(trim(p_fragrance#>>'{details,brand}'))||':'||lower(trim(p_fragrance#>>'{details,name}'))||':'||lower(trim(coalesce(p_fragrance#>>'{details,concentration}',''))) end;
 if (select count(*) from public.wishlist where owner_id=me)>=100 and not exists(select 1 from public.wishlist where owner_id=me and identity=ident) then raise exception 'Your wishlist supports 100 fragrances.';end if;
 insert into public.wishlist(owner_id,identity,fragrance) values(me,ident,p_fragrance) on conflict(owner_id,identity) do update set fragrance=excluded.fragrance returning id into result;return result;
end $$;
create function public.remove_wish(p_id uuid) returns void language plpgsql security definer set search_path='' as $$begin delete from public.wishlist where id=p_id and owner_id=private.member_id();end $$;
create table private.catalog_cache(key text primary key,payload jsonb not null,expires_at timestamptz not null,created_at timestamptz not null default now());
create table private.catalog_limits(user_id uuid primary key references public.profiles(id) on delete cascade,started_at timestamptz not null,hits integer not null);
alter table private.catalog_cache enable row level security;
alter table private.catalog_limits enable row level security;
create function public.catalog_admission() returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();n integer;begin
 insert into private.catalog_limits values(me,now(),1) on conflict(user_id) do update set started_at=case when private.catalog_limits.started_at<now()-interval '1 minute' then now() else private.catalog_limits.started_at end,hits=case when private.catalog_limits.started_at<now()-interval '1 minute' then 1 else private.catalog_limits.hits+1 end returning hits into n;
 if n>30 then raise exception 'Too many catalog lookups. Wait a minute or enter details yourself.';end if;
end $$;
create function public.catalog_cached(p_key text) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('payload',payload,'stale',expires_at<now()) from private.catalog_cache where key=p_key$$;
create function public.catalog_store(p_key text,p_payload jsonb,p_profile boolean) returns void language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtext('fraggy-catalog-cache'));
 if length(p_payload::text)>100000 or length(p_key)>2000 then raise exception 'Catalog response too large.';end if;
 delete from private.catalog_cache where expires_at<now()-interval '7 days';
 insert into private.catalog_cache values(p_key,p_payload,now()+case when p_profile then interval '7 days' else interval '1 hour' end,now()) on conflict(key) do update set payload=excluded.payload,expires_at=excluded.expires_at,created_at=excluded.created_at;
 delete from private.catalog_cache where key in(select key from private.catalog_cache order by created_at desc offset 1000);
end $$;

create or replace function public.finalize_capture(p_job uuid,p_data jsonb,p_shelf uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();j public.capture_jobs;sid uuid;bid uuid;begin
 perform pg_advisory_xact_lock(hashtext(me::text));
 select * into j from public.capture_jobs where id=p_job and owner_id=me for update;
 if length(p_data::text)>16000 then raise exception 'Bottle details are too long.';end if;
 if j.id is null then raise exception 'Capture not found.';end if;
 if j.bottle_id is not null then return j.bottle_id;end if;
 if not private.valid_fragrance(p_data->'fragrance') then raise exception 'Check fragrance details.';end if;
 if j.status<>'ready' then raise exception 'Your cutout is not ready yet.';end if;
 if (select count(*) from public.bottles where owner_id=me and not archived)>=25 then raise exception 'The beta bottle limit is 25.';end if;
 if not exists(select 1 from storage.objects where bucket_id='cutouts' and name=j.cutout_path and (metadata->>'size')::bigint<=500000) then raise exception 'The processed cutout is missing. Retry processing.';end if;
 sid:=coalesce(p_shelf,private.ensure_shelf(me));
 if not exists(select 1 from public.shelves where id=sid and owner_id=me) then raise exception 'Choose your own shelf.';end if;
 insert into public.bottles(owner_id,brand,name,size_ml,remaining_percent,image_path,image_kind,image_width,image_height,original_path,shelf_id,position,condition,has_cap,has_box,trade_available,methods,notes,fragrance)
 values(me,trim(p_data->>'brand'),trim(p_data->>'name'),(p_data->>'size_ml')::integer,(p_data->>'remaining_percent')::integer,j.cutout_path,'cutout',j.width,j.height,j.original_path,sid,(select count(*) from public.bottles where owner_id=me and shelf_id=sid),coalesce(p_data->>'condition','good'),coalesce((p_data->>'has_cap')::boolean,true),coalesce((p_data->>'has_box')::boolean,false),coalesce((p_data->>'trade_available')::boolean,false),coalesce(array(select jsonb_array_elements_text(p_data->'methods')),array['local']),coalesce(p_data->>'notes',''),p_data->'fragrance') returning id into bid;
 update public.capture_jobs set bottle_id=bid,updated_at=now() where id=p_job;return bid;
end $$;
create or replace function public.edit_bottle(p_bottle uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(); b public.bottles;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 perform pg_advisory_xact_lock(hashtext(me::text));
 select * into b from public.bottles where id=p_bottle and owner_id=me for update;
 if length(p_data::text)>16000 then raise exception 'Bottle details are too long.';end if;
 if b.id is null or b.reserved_trade_id is not null then raise exception 'Reserved bottles cannot be edited or removed.';end if;
 if b.archived and p_data->>'archived'='false' and (select count(*) from public.bottles where owner_id=me and not archived)>=25 then raise exception 'The free beta supports 25 bottles per collector.';end if;
 update public.bottles set brand=coalesce(nullif(trim(p_data->>'brand'),''),brand),name=coalesce(nullif(trim(p_data->>'name'),''),name),size_ml=coalesce((p_data->>'size_ml')::integer,size_ml),remaining_percent=coalesce((p_data->>'remaining_percent')::integer,remaining_percent),condition=coalesce(p_data->>'condition',condition),has_cap=coalesce((p_data->>'has_cap')::boolean,has_cap),has_box=coalesce((p_data->>'has_box')::boolean,has_box),trade_available=coalesce((p_data->>'trade_available')::boolean,trade_available),methods=case when p_data?'methods' then array(select jsonb_array_elements_text(p_data->'methods')) else methods end,fragrance=case when p_data?'fragrance' then p_data->'fragrance' else fragrance end,notes=coalesce(p_data->>'notes',notes),archived=coalesce((p_data->>'archived')::boolean,archived),version=version+1,updated_at=now() where id=p_bottle;
 update public.trades set status='expired',updated_at=now() where status='proposed' and p_bottle in(offered_bottle_id,requested_bottle_id);
end $$;

create or replace function public.start_capture(p_job uuid,p_draft jsonb default '{}') returns public.capture_jobs language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();j public.capture_jobs;begin
 select * into j from public.capture_jobs where id=p_job and owner_id=me for update;
 if j.id is null or j.bottle_id is not null or j.status='expired' then raise exception 'Capture not found.';end if;
 if length(p_draft::text)>16000 then raise exception 'Capture details are too long.';end if;
 if j.status='ready' then return j;end if;
 if j.status='processing' and j.lease_until>now() then return j;end if;
 if not exists(select 1 from storage.objects where bucket_id='cutouts' and name=j.original_path and (metadata->>'size')::bigint<=500000) then raise exception 'Upload the original photo first (500 KB maximum).';end if;
 update public.capture_jobs set status='queued',error=null,draft=p_draft,updated_at=now() where id=p_job returning * into j;return j;
end $$;

create or replace function public.save_capture_draft(p_job uuid,p_draft jsonb) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);begin
 if length(p_draft::text)>16000 then raise exception 'Capture details are too long.';end if;
 update public.capture_jobs set draft=p_draft,updated_at=now() where id=p_job and owner_id=me and bottle_id is null;
end $$;

revoke all on function public.save_wish(jsonb),public.remove_wish(uuid),public.catalog_admission(),public.catalog_cached(text),public.catalog_store(text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.save_wish(jsonb),public.remove_wish(uuid),public.catalog_admission() to authenticated;
grant execute on function public.catalog_cached(text),public.catalog_store(text,jsonb,boolean) to service_role;
create function public.beta_section(p_section text) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if not private.is_member() then raise exception 'Sign in with an active invitation.' using errcode='42501';end if;
 case p_section
 when 'collection' then return jsonb_build_object('bottles',coalesce((select jsonb_agg(to_jsonb(b) order by b.position,b.created_at) from public.bottles b where not b.archived),'[]'::jsonb),'shelves',coalesce((select jsonb_agg(to_jsonb(s) order by s.position,s.created_at) from public.shelves s),'[]'::jsonb));
 when 'community' then return jsonb_build_object('profiles',coalesce((select jsonb_agg(to_jsonb(p)) from public.profiles p),'[]'::jsonb),'reviews',coalesce((select jsonb_agg(to_jsonb(r)) from public.reviews r),'[]'::jsonb));
 when 'trading' then return jsonb_build_object('trades',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from public.trades t),'[]'::jsonb),'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.sent_at) from public.trade_messages m),'[]'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.trade_events e),'[]'::jsonb),'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.notifications n),'[]'::jsonb));
 when 'account' then return jsonb_build_object('blocks',coalesce((select jsonb_agg(to_jsonb(b)) from public.blocks b),'[]'::jsonb),'reports',coalesce((select jsonb_agg(to_jsonb(r)) from public.reports r),'[]'::jsonb),'user_id',auth.uid(),'is_admin',private.is_admin(),'wishlist',coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from public.wishlist w),'[]'::jsonb));
 when 'jobs' then return jsonb_build_object('jobs',coalesce((select jsonb_agg(to_jsonb(j) order by j.created_at desc) from public.capture_jobs j where j.bottle_id is null and j.status<>'expired'),'[]'::jsonb));
 else raise exception 'Unknown app section.';end case;end $$;
revoke all on function public.beta_section(text) from public,anon;grant execute on function public.beta_section(text) to authenticated;

create function public.catalog_cleanup() returns void language sql security definer set search_path='' as $$delete from private.catalog_cache where expires_at<now()-interval '7 days'$$;
revoke all on function public.catalog_cleanup() from public,anon,authenticated;grant execute on function public.catalog_cleanup() to service_role;

-- Owner-only preview mirrors the normal invited-member listing predicate, excluding owner bypass.
create function public.preview_shelf() returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);begin return jsonb_build_object('shared',(select shelf_public from public.profiles where id=me),'bottles',coalesce((select jsonb_agg(to_jsonb(b)) from public.bottles b join public.profiles p on p.id=b.owner_id where b.owner_id=me and not b.archived and not b.suspended and p.deleted_at is null and exists(select 1 from private.members m where m.user_id=me and not m.suspended) and (b.trade_available or p.shelf_public)),'[]'::jsonb));end $$;
revoke all on function public.preview_shelf() from public,anon;grant execute on function public.preview_shelf() to authenticated;

create function public.reviewed_propose_trade(p_offered uuid,p_requested uuid,p_method text,p_offered_version integer,p_requested_version integer) returns uuid language plpgsql security definer set search_path='' as $$begin
 perform private.member_id();perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 if (select version from public.bottles where id=p_offered) is distinct from p_offered_version or (select version from public.bottles where id=p_requested) is distinct from p_requested_version then raise exception 'Bottle details changed. Review the updated offer.';end if;
 return public.propose_trade(p_offered,p_requested,p_method);
end $$;
revoke all on function public.reviewed_propose_trade(uuid,uuid,text,integer,integer) from public,anon;grant execute on function public.reviewed_propose_trade(uuid,uuid,text,integer,integer) to authenticated;

create function private.purge_collector_extras() returns trigger language plpgsql security definer set search_path='' as $$begin delete from public.wishlist where owner_id=old.user_id;delete from private.catalog_limits where user_id=old.user_id;return old;end $$;
revoke all on function private.purge_collector_extras() from public,anon,authenticated;
create trigger purge_collector_extras after delete on private.members for each row execute function private.purge_collector_extras();

-- Match existing publication configuration; local SQL tests have no publication.
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='wishlist') then alter publication supabase_realtime add table public.wishlist;end if;end$$;
