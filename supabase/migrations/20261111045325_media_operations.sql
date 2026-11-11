-- Quota reservations for supplemental photos; never accept arbitrary asset paths.
create table private.upload_tickets(path text primary key,user_id uuid not null,kind text not null,maximum integer not null,created_at timestamptz not null default now());
alter table private.upload_tickets enable row level security;
create table private.deletion_requests(user_id uuid primary key,created_at timestamptz not null default now());
alter table private.deletion_requests enable row level security;
grant all on private.upload_tickets,private.deletion_requests to service_role;
create or replace function public.extra_photo_ticket(p_kind text,p_size integer) returns text language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();path text;used bigint;maximum integer;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-uploads'));
 maximum:=case p_kind when 'avatar' then 100000 when 'condition' then 250000 else 0 end;
 if maximum=0 or p_size not between 1 and maximum then raise exception 'Invalid supplemental photo size.';end if;
 if (select count(*) from private.upload_tickets where user_id=me and created_at>=date_trunc('day',now()))>=10 then raise exception 'Daily supplemental photo limit reached.';end if;
 select coalesce(sum((metadata->>'size')::bigint),0) into used from storage.objects where bucket_id='cutouts';
 if used+(select count(*)*1000000 from public.capture_jobs where bottle_id is null and status in('uploading','queued','waking','processing','failed'))+(select count(*)*500000 from private.upload_tickets where created_at>now()-interval '2 hours')+500000>800000000 then raise exception 'Beta photo storage is full.';end if;
 path:=case p_kind when 'avatar' then 'avatars/' else 'conditions/' end||me||'/'||gen_random_uuid()||'.jpg';
 insert into private.upload_tickets values(path,me,p_kind,maximum,now());return path;
end $$;
create or replace function public.attach_photo(p_path text,p_bottle uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();ticket private.upload_tickets;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 select * into ticket from private.upload_tickets where path=p_path and user_id=me;
 if ticket.path is null or (ticket.kind='condition')<>(p_bottle is not null) then raise exception 'Photo ticket is unavailable.';end if;
 if not exists(select 1 from storage.objects where bucket_id='cutouts' and name=p_path and (metadata->>'size')::bigint<=ticket.maximum and metadata->>'mimetype'='image/jpeg') then raise exception 'Photo is missing or too large.';end if;
 if p_bottle is null then update public.profiles set avatar_url=p_path where id=me;
 else
  perform 1 from public.bottles where id=p_bottle and owner_id=me and reserved_trade_id is null for update;if not found then raise exception 'Reserved or unavailable bottle.';end if;
  update public.bottles set condition_path=p_path,version=version+1,updated_at=now() where id=p_bottle;
  update public.trades set status='expired',updated_at=now() where status='proposed' and p_bottle in(offered_bottle_id,requested_bottle_id);
 end if;
end $$;
create or replace function public.resume_capture(p_job uuid) returns public.capture_jobs language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();j public.capture_jobs;begin
 select * into j from public.capture_jobs where id=p_job and owner_id=me and bottle_id is null and status='uploading';
 if j.id is null then raise exception 'Upload is unavailable.';end if;return j;
end $$;
create or replace function public.collector_stats(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.member_id(false);
 if private.blocked(auth.uid(),p_user) then return '{}'::jsonb;end if;
 return jsonb_build_object('completed_trades',(select count(*) from public.trades where status='complete' and p_user in(proposer_id,recipient_id)));
end $$;
-- Deletion can be safely retried if the Auth service was unavailable after preparation.
alter function public.prepare_account_deletion() rename to prepare_account_deletion_once;
revoke execute on function public.prepare_account_deletion_once() from public,anon,authenticated;
create function public.prepare_account_deletion() returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 if exists(select 1 from private.deletion_requests where user_id=auth.uid())then return;end if;
 perform public.prepare_account_deletion_once();
 insert into private.deletion_requests(user_id)values(auth.uid())on conflict do nothing;
end $$;
create or replace function public.orphan_media() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(o.name),'[]') from storage.objects o where o.bucket_id='cutouts' and o.created_at<now()-interval '7 days'
 and not exists(select 1 from public.bottles b where o.name in(b.image_path,b.original_path,b.condition_path))
 and not exists(select 1 from public.profiles p where p.avatar_url=o.name)
 and not exists(select 1 from public.capture_jobs j where j.status<>'expired' and o.name in(j.original_path,j.cutout_path))
 and not exists(select 1 from public.trades t where o.name in(t.snapshot#>>'{offered,image_path}',t.snapshot#>>'{offered,original_path}',t.snapshot#>>'{offered,condition_path}',t.snapshot#>>'{requested,image_path}',t.snapshot#>>'{requested,original_path}',t.snapshot#>>'{requested,condition_path}'));
$$;
-- Restrict all additions explicitly (Supabase defaults grant PUBLIC EXECUTE).
revoke all on function public.extra_photo_ticket(text,integer),public.attach_photo(text,uuid),public.resume_capture(uuid),public.collector_stats(uuid),public.prepare_account_deletion(),public.orphan_media() from public,anon,authenticated;
grant execute on function public.extra_photo_ticket(text,integer),public.attach_photo(text,uuid),public.resume_capture(uuid),public.collector_stats(uuid),public.prepare_account_deletion() to authenticated;
grant execute on all functions in schema public to service_role;

create or replace function public.worker_authorize(p_job uuid,p_ticket text,p_token text) returns boolean language sql security definer set search_path='' as $$
 select public.worker_validate_dispatch(p_job,p_ticket) and exists(select 1 from private.settings where key='worker_token_hash' and value=encode(extensions.digest(p_token,'sha256'),'hex'));
$$;
revoke all on function public.worker_authorize(uuid,text,text) from public,anon,authenticated;
grant execute on function public.worker_authorize(uuid,text,text) to service_role;

alter table public.reports drop constraint reports_check;
alter table public.reports add constraint reports_check check(reported_user_id is not null or reported_bottle_id is not null or trade_id is not null);
