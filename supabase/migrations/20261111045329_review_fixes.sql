alter table public.capture_jobs add column upload_valid_until timestamptz not null default now()+interval '2 hours 5 minutes';
alter table public.capture_jobs add column cleanup_completed_at timestamptz;
-- Final independent review: atomic cleanup, consistent quotas and proposal rights.


create function private.storage_admission(p_bytes bigint) returns void language plpgsql security definer set search_path='' as $$
declare used bigint;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-uploads'));
 select coalesce(sum((metadata->>'size')::bigint),0) into used from storage.objects where bucket_id='cutouts';
 if used+(select count(*)*1000000 from public.capture_jobs where bottle_id is null and (status<>'expired' or upload_valid_until>now()))+(select count(*)*500000 from private.upload_tickets where created_at>now()-interval '2 hours')+p_bytes>800000000 then raise exception 'Beta photo storage is full. Existing shelves remain available.';end if;
end $$;

create or replace function public.create_capture() returns public.capture_jobs language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(); jid uuid:=gen_random_uuid(); j public.capture_jobs; used bigint;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-uploads'));
 if (select count(*) from public.bottles where owner_id=me and not archived)>=25 then raise exception 'The free beta supports 25 bottles per collector.';end if;
 if (select count(*) from public.capture_jobs where owner_id=me and created_at>=date_trunc('day',now()))>=10 then raise exception 'Daily photo limit reached. Try again tomorrow.';end if;
 perform private.storage_admission(1000000);
 insert into public.capture_jobs(id,owner_id,original_path,cutout_path) values(jid,me,'captures/'||me||'/'||jid||'/original.jpg','captures/'||me||'/'||jid||'/cutout.png') returning * into j;return j;
end $$;

create or replace function public.extra_photo_ticket(p_kind text,p_size integer) returns text language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();path text;used bigint;maximum integer;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-uploads'));
 maximum:=case p_kind when 'avatar' then 100000 when 'condition' then 250000 else 0 end;
 if maximum=0 or p_size not between 1 and maximum then raise exception 'Invalid supplemental photo size.';end if;
 if (select count(*) from private.upload_tickets where user_id=me and created_at>=date_trunc('day',now()))>=10 then raise exception 'Daily supplemental photo limit reached.';end if;
 perform private.storage_admission(500000);
 path:=case p_kind when 'avatar' then 'avatars/' else 'conditions/' end||me||'/'||gen_random_uuid()||'.jpg';
 insert into private.upload_tickets values(path,me,p_kind,maximum,now());return path;
end $$;

create or replace function public.attach_photo(p_path text,p_bottle uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();ticket private.upload_tickets;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 select * into ticket from private.upload_tickets where path=p_path and user_id=me and created_at>now()-interval '2 hours';
 if ticket.path is null or (ticket.kind='condition')<>(p_bottle is not null) then raise exception 'Photo ticket is unavailable.';end if;
 if not exists(select 1 from storage.objects where bucket_id='cutouts' and name=p_path and (metadata->>'size')::bigint<=ticket.maximum and metadata->>'mimetype'='image/jpeg') then raise exception 'Photo is missing or too large.';end if;
 if p_bottle is null then update public.profiles set avatar_url=p_path where id=me;
 else
  perform 1 from public.bottles where id=p_bottle and owner_id=me and reserved_trade_id is null for update;if not found then raise exception 'Reserved or unavailable bottle.';end if;
  update public.bottles set condition_path=p_path,version=version+1,updated_at=now() where id=p_bottle;
  update public.trades set status='expired',updated_at=now() where status='proposed' and p_bottle in(offered_bottle_id,requested_bottle_id);
 end if;
end $$;

create or replace function public.edit_bottle(p_bottle uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(); b public.bottles;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 perform pg_advisory_xact_lock(hashtext(me::text));
 select * into b from public.bottles where id=p_bottle and owner_id=me for update;
 if length(p_data::text)>6000 then raise exception 'Bottle details are too long.';end if;
 if b.id is null or b.reserved_trade_id is not null then raise exception 'Reserved bottles cannot be edited or removed.';end if;
 if b.archived and p_data->>'archived'='false' and (select count(*) from public.bottles where owner_id=me and not archived)>=25 then raise exception 'The free beta supports 25 bottles per collector.';end if;
 update public.bottles set brand=coalesce(nullif(trim(p_data->>'brand'),''),brand),name=coalesce(nullif(trim(p_data->>'name'),''),name),size_ml=coalesce((p_data->>'size_ml')::integer,size_ml),remaining_percent=coalesce((p_data->>'remaining_percent')::integer,remaining_percent),condition=coalesce(p_data->>'condition',condition),has_cap=coalesce((p_data->>'has_cap')::boolean,has_cap),has_box=coalesce((p_data->>'has_box')::boolean,has_box),trade_available=coalesce((p_data->>'trade_available')::boolean,trade_available),methods=case when p_data?'methods' then array(select jsonb_array_elements_text(p_data->'methods')) else methods end,notes=coalesce(p_data->>'notes',notes),archived=coalesce((p_data->>'archived')::boolean,archived),version=version+1,updated_at=now() where id=p_bottle;
 update public.trades set status='expired',updated_at=now() where status='proposed' and p_bottle in(offered_bottle_id,requested_bottle_id);
end $$;

create or replace function public.trade_action(p_trade uuid,p_action text,p_data jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);t public.trades;mutual boolean;begin
 if length(p_data::text)>3000 then raise exception 'Exchange details are too long.';end if;
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 select * into t from public.trades where id=p_trade for update;
 if t.id is null or me not in(t.proposer_id,t.recipient_id) then raise exception 'Only the participants can change this trade.';end if;
 if t.status in('complete','declined','cancelled','expired') then raise exception 'This trade has ended.';end if;
 if p_action='decline' and t.status in('proposed','paused') and not(t.proposer_id=any(t.accepted_by) and t.recipient_id=any(t.accepted_by)) and me=t.recipient_id then update public.trades set status='declined',updated_at=now() where id=t.id;
 elsif p_action='cancel' and t.status in('proposed','paused') and not(t.proposer_id=any(t.accepted_by) and t.recipient_id=any(t.accepted_by)) and me=t.proposer_id then update public.trades set status='cancelled',updated_at=now() where id=t.id;
 elsif p_action='cancel' and t.status in('in-progress','paused') then
  if coalesce(array_length(t.dispatched_by,1),0)>0 or coalesce(array_length(t.received_by,1),0)>0 then raise exception 'An exchange has started. Report a problem instead.';end if;
  t.cancel_by:=array(select distinct unnest(t.cancel_by||me));mutual:=t.proposer_id=any(t.cancel_by) and t.recipient_id=any(t.cancel_by);
  if mutual then perform set_config('fraggy.trade_fn','on',true);update public.bottles set reserved_trade_id=null where reserved_trade_id=t.id;end if;
  update public.trades set cancel_by=t.cancel_by,status=case when mutual then 'cancelled' else status end,updated_at=now() where id=t.id;
 elsif p_action='keep' and t.status='in-progress' then update public.trades set cancel_by='{}',updated_at=now() where id=t.id;
 elsif p_action='resume' and t.status='paused' then
  if t.expires_at<=now() and not(t.proposer_id=any(t.accepted_by) and t.recipient_id=any(t.accepted_by))then raise exception 'This unanswered proposal has expired.';end if;
  t.resume_by:=array(select distinct unnest(t.resume_by||me));mutual:=t.proposer_id=any(t.resume_by) and t.recipient_id=any(t.resume_by);
  update public.trades set resume_by=t.resume_by,status=case when mutual then case when t.proposer_id=any(t.accepted_by) and t.recipient_id=any(t.accepted_by) then 'in-progress' else 'proposed' end else 'paused' end,updated_at=now() where id=t.id;
 elsif p_action='exchange' and t.status='in-progress' then
  if length(p_data::text)>3000 then raise exception 'Exchange details are too long.';end if;
  update public.trades set exchange=jsonb_set(exchange,array[me::text],p_data),updated_at=now() where id=t.id;
 elsif p_action='dispatch' and t.status='in-progress' and t.method='shipping' and coalesce(array_length(t.cancel_by,1),0)=0 then
  if length(trim(coalesce(p_data->>'carrier','')))=0 or length(trim(coalesce(p_data->>'tracking','')))=0 then raise exception 'Add a carrier and tracking reference first.';end if;
  update public.trades set exchange=jsonb_set(exchange,array[me::text],p_data),dispatched_by=array(select distinct unnest(t.dispatched_by||me)),updated_at=now() where id=t.id;
 else raise exception 'This action is unavailable in the current trade state.';end if;
 perform private.event(t.id,me,p_action);
end $$;

create or replace function public.prepare_account_deletion_once() returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 if exists(select 1 from public.trades where me in(proposer_id,recipient_id) and status in('in-progress','paused') and proposer_id=any(accepted_by) and recipient_id=any(accepted_by))then raise exception 'Resolve your accepted or paused trades before deleting this account.';end if;
 if private.is_admin() and (select count(*)from private.members where is_admin)<2 then raise exception 'Transfer founder access before deleting the founder account.';end if;
 perform set_config('fraggy.trade_fn','on',true);
 update public.trades set status='cancelled',updated_at=now()where me in(proposer_id,recipient_id)and status in('proposed','paused') and not(proposer_id=any(accepted_by) and recipient_id=any(accepted_by));
 update public.bottles set archived=true,trade_available=false where owner_id=me;
 update public.profiles set handle='@deleted_'||replace(left(me::text,18),'-',''),name='Deleted collector',city='',bio='',avatar_url=null,shelf_public=false,deleted_at=now()where id=me;
 update public.trades set exchange=exchange-me::text where me in(proposer_id,recipient_id);
 delete from private.members where user_id=me;
end $$;

create function public.claim_capture_cleanup(p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.capture_jobs;begin
 select * into j from public.capture_jobs where id=p_job for update;
 if j.id is null or j.bottle_id is not null or j.cleanup_completed_at is not null or j.created_at>=now()-interval '7 days' or(j.status='processing' and j.lease_until>now()) then return null;end if;
 -- Expire under the same row lock used by finalize_capture before returning paths.
 -- Already expired jobs remain claimable so a failed Storage deletion is retried.
 update public.capture_jobs set status='expired',lease_until=null,error='Capture expired. Take a new photo.',updated_at=now() where id=j.id;
 return jsonb_build_object('id',j.id,'original_path',j.original_path,'cutout_path',j.cutout_path);
end $$;

create or replace function public.maintenance_candidates() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'original_path',j.original_path,'cutout_path',j.cutout_path)),'[]')from public.capture_jobs j where j.bottle_id is null and j.created_at<now()-interval '7 days' and j.cleanup_completed_at is null;
$$;

create function private.expire_unaccepted() returns void language plpgsql security definer set search_path='' as $$
declare t public.trades;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 for t in update public.trades set status='expired',updated_at=now() where status in('proposed','paused') and expires_at<=now() and not(proposer_id=any(accepted_by) and recipient_id=any(accepted_by)) returning * loop
  insert into public.trade_events(trade_id,kind)values(t.id,'expired');
  perform private.notify(t.proposer_id,t.id,'expired','Unanswered proposal expired.');
  perform private.notify(t.recipient_id,t.id,'expired','Unanswered proposal expired.');
 end loop;
end $$;
create or replace function public.expire_proposals() returns void language plpgsql security definer set search_path='' as $$
begin perform private.member_id(false);perform private.expire_unaccepted();end $$;
create function public.maintenance_expire_proposals() returns void language plpgsql security definer set search_path='' as $$
begin perform private.expire_unaccepted();end $$;
revoke all on function private.storage_admission(bigint),private.expire_unaccepted(),public.claim_capture_cleanup(uuid),public.maintenance_expire_proposals() from public,anon,authenticated;
grant execute on function public.claim_capture_cleanup(uuid),public.maintenance_expire_proposals() to service_role;

create or replace function public.report_problem(p_user uuid default null,p_bottle uuid default null,p_trade uuid default null,p_reason text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);rid uuid;begin
 if length(trim(p_reason)) not between 1 and 500 then raise exception 'Describe the problem in 1–500 characters.';end if;
 if p_trade is not null and not private.trade_party(p_trade) then raise exception 'Trade unavailable.';end if;
 if p_bottle is not null and not private.can_read_bottle(p_bottle) then raise exception 'Bottle unavailable.';end if;
 insert into public.reports(reporter_id,reported_user_id,reported_bottle_id,trade_id,reason)values(me,p_user,p_bottle,p_trade,trim(p_reason))returning id into rid;
 if p_trade is not null and exists(select 1 from public.trades where id=p_trade and status in('proposed','in-progress','paused')) then perform public.pause_trade(p_trade);end if;return rid;
end $$;

create function public.record_upload_lease(p_job uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.capture_jobs set upload_valid_until=now()+interval '2 hours 5 minutes' where id=p_job and bottle_id is null and status<>'expired';
 if not found then raise exception 'Upload expired or unavailable.';end if;
end $$;
create function public.finish_capture_cleanup(p_job uuid) returns void language sql security definer set search_path='' as $$
 update public.capture_jobs set cleanup_completed_at=now() where id=p_job and status='expired' and bottle_id is null;
$$;
revoke all on function public.record_upload_lease(uuid),public.finish_capture_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.record_upload_lease(uuid),public.finish_capture_cleanup(uuid) to service_role;
