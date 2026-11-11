create or replace function private.notify(p_user uuid,p_trade uuid,p_kind text,p_text text) returns void language sql security definer set search_path='' as $$
 insert into public.notifications(user_id,trade_id,kind,text)values(p_user,p_trade,p_kind,left(p_text,300));
$$;
create or replace function private.event(p_trade uuid,p_actor uuid,p_kind text,p_details jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare other uuid;begin
 insert into public.trade_events(trade_id,actor_id,kind,details)values(p_trade,p_actor,p_kind,p_details);
 select case when proposer_id=p_actor then recipient_id else proposer_id end into other from public.trades where id=p_trade;
 perform private.notify(other,p_trade,p_kind,replace(p_kind,'_',' '));
end $$;
create or replace function public.guard_bottle_update() returns trigger language plpgsql set search_path='' as $$
begin
 if current_setting('fraggy.trade_fn',true) is distinct from 'on' then
  if new.owner_id<>old.owner_id or new.reserved_trade_id is distinct from old.reserved_trade_id then raise exception 'Ownership and reservations change only through trades.';end if;
  if old.reserved_trade_id is not null and new is distinct from old then raise exception 'Reserved bottles cannot be edited.';end if;
 end if;return new;
end $$;
create or replace function public.propose_trade(p_offered uuid,p_requested uuid,p_method text) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();o public.bottles;r public.bottles;tid uuid;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 perform 1 from public.bottles where id in(p_offered,p_requested) order by id for update;
 select * into o from public.bottles where id=p_offered;select * into r from public.bottles where id=p_requested;
 if o.id is null or r.id is null or o.owner_id<>me or r.owner_id=me or p_offered=p_requested then raise exception 'Choose your bottle and a bottle from another collector.';end if;
 if private.blocked(me,r.owner_id) or not exists(select 1 from private.members where user_id=r.owner_id and not suspended) then raise exception 'This collector is unavailable.';end if;
 if not o.trade_available or not r.trade_available or o.reserved_trade_id is not null or r.reserved_trade_id is not null or o.archived or r.archived or o.suspended or r.suspended then raise exception 'A bottle is unavailable for a new trade.';end if;
 if p_method not in('local','shipping') or not(p_method=any(o.methods)) or not(p_method=any(r.methods)) then raise exception 'Choose an exchange method mutual collectors offer.';end if;
 if exists(select 1 from public.trades where proposer_id=me and offered_bottle_id=o.id and requested_bottle_id=r.id and status in('proposed','in-progress','paused')) then raise exception 'You already have an open offer for these bottles.';end if;
 insert into public.trades(offered_bottle_id,requested_bottle_id,proposer_id,recipient_id,method,accepted_by,snapshot)
 values(o.id,r.id,me,r.owner_id,p_method,array[me],jsonb_build_object('offered',to_jsonb(o),'requested',to_jsonb(r))) returning id into tid;
 perform private.event(tid,me,'proposal');return tid;
end $$;
create or replace function public.accept_trade(p_trade uuid) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();t public.trades;o public.bottles;r public.bottles;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 select * into t from public.trades where id=p_trade for update;
 if t.id is null or me not in(t.proposer_id,t.recipient_id) then raise exception 'Only the trade participants may accept.';end if;
 if t.status='in-progress' then return;end if;
 if t.status<>'proposed' or t.expires_at<=now() then raise exception 'This proposal is no longer available.';end if;
 if not exists(select 1 from private.members where user_id=t.proposer_id and not suspended) or not exists(select 1 from private.members where user_id=t.recipient_id and not suspended) then raise exception 'A collector is restricted.';end if;
 if private.blocked(t.proposer_id,t.recipient_id) then raise exception 'This collector is unavailable.';end if;
 perform 1 from public.bottles where id in(t.offered_bottle_id,t.requested_bottle_id) order by id for update;
 select * into o from public.bottles where id=t.offered_bottle_id;select * into r from public.bottles where id=t.requested_bottle_id;
 if o.owner_id<>t.proposer_id or r.owner_id<>t.recipient_id or not o.trade_available or not r.trade_available or o.archived or r.archived or o.suspended or r.suspended or o.reserved_trade_id is not null or r.reserved_trade_id is not null then raise exception 'A bottle is already reserved or unavailable.';end if;
 if (t.snapshot#>>'{offered,version}')::integer is distinct from o.version or (t.snapshot#>>'{requested,version}')::integer is distinct from r.version then raise exception 'Bottle details changed. Make a new offer.';end if;
 if not(me=any(t.accepted_by)) then t.accepted_by:=array_append(t.accepted_by,me);end if;
 if t.proposer_id=any(t.accepted_by) and t.recipient_id=any(t.accepted_by) then
  perform set_config('fraggy.trade_fn','on',true);
  update public.bottles set reserved_trade_id=t.id where id in(o.id,r.id);
  update public.trades set accepted_by=t.accepted_by,status='in-progress',updated_at=now() where id=t.id;
  update public.trades set status='expired',updated_at=now() where id<>t.id and status='proposed' and (offered_bottle_id in(o.id,r.id) or requested_bottle_id in(o.id,r.id));
 else update public.trades set accepted_by=t.accepted_by,updated_at=now() where id=t.id;end if;
 perform private.event(t.id,me,'accepted');
end $$;
create or replace function public.confirm_receipt(p_trade uuid) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);t public.trades;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 select * into t from public.trades where id=p_trade for update;
 if t.id is null or me not in(t.proposer_id,t.recipient_id) then raise exception 'Only the trade participants may confirm receipt.';end if;
 if t.status='complete' then return;end if;
 if t.status<>'in-progress' or array_length(t.cancel_by,1)>0 then raise exception 'Resolve the pause or cancellation request before confirming receipt.';end if;
 if not(t.proposer_id=any(t.accepted_by) and t.recipient_id=any(t.accepted_by)) then raise exception 'Both collectors must accept first.';end if;
 perform 1 from public.bottles where id in(t.offered_bottle_id,t.requested_bottle_id) order by id for update;
 if exists(select 1 from public.bottles where id in(t.offered_bottle_id,t.requested_bottle_id) and reserved_trade_id is distinct from t.id) then raise exception 'The reservation has changed.';end if;
 if me=any(t.received_by) then return;end if;t.received_by:=array_append(t.received_by,me);
 if t.proposer_id=any(t.received_by) and t.recipient_id=any(t.received_by) then
  perform set_config('fraggy.trade_fn','on',true);
  update public.bottles set owner_id=t.recipient_id,shelf_id=private.ensure_shelf(t.recipient_id),position=(select count(*) from public.bottles where owner_id=t.recipient_id),reserved_trade_id=null,trade_available=false,updated_at=now() where id=t.offered_bottle_id;
  update public.bottles set owner_id=t.proposer_id,shelf_id=private.ensure_shelf(t.proposer_id),position=(select count(*) from public.bottles where owner_id=t.proposer_id),reserved_trade_id=null,trade_available=false,updated_at=now() where id=t.requested_bottle_id;
  update public.trades set received_by=t.received_by,status='complete',updated_at=now() where id=t.id;
  perform private.event(t.id,me,'complete');perform private.notify(me,t.id,'complete','Both receipts confirmed. Your shelf is updated.');
 else update public.trades set received_by=t.received_by,updated_at=now() where id=t.id;perform private.event(t.id,me,'received');end if;
end $$;
create or replace function public.pause_trade(p_trade uuid) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);t public.trades;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 select * into t from public.trades where id=p_trade for update;
 if t.id is null or me not in(t.proposer_id,t.recipient_id) then raise exception 'Only these collectors can pause this trade.';end if;
 if t.status not in('proposed','in-progress','paused') then raise exception 'This trade has ended.';end if;
 -- Reservations intentionally remain locked while a problem is unresolved.
 update public.trades set status='paused',resume_by='{}',updated_at=now() where id=t.id;
 perform private.event(t.id,me,'paused');
end $$;
create or replace function public.trade_action(p_trade uuid,p_action text,p_data jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);t public.trades;mutual boolean;begin
 if length(p_data::text)>3000 then raise exception 'Exchange details are too long.';end if;
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 select * into t from public.trades where id=p_trade for update;
 if t.id is null or me not in(t.proposer_id,t.recipient_id) then raise exception 'Only the participants can change this trade.';end if;
 if t.status in('complete','declined','cancelled','expired') then raise exception 'This trade has ended.';end if;
 if p_action='decline' and t.status='proposed' and me=t.recipient_id then update public.trades set status='declined',updated_at=now() where id=t.id;
 elsif p_action='cancel' and t.status='proposed' and me=t.proposer_id then update public.trades set status='cancelled',updated_at=now() where id=t.id;
 elsif p_action='cancel' and t.status in('in-progress','paused') then
  if coalesce(array_length(t.dispatched_by,1),0)>0 or coalesce(array_length(t.received_by,1),0)>0 then raise exception 'An exchange has started. Report a problem instead.';end if;
  t.cancel_by:=array(select distinct unnest(t.cancel_by||me));mutual:=t.proposer_id=any(t.cancel_by) and t.recipient_id=any(t.cancel_by);
  if mutual then perform set_config('fraggy.trade_fn','on',true);update public.bottles set reserved_trade_id=null where reserved_trade_id=t.id;end if;
  update public.trades set cancel_by=t.cancel_by,status=case when mutual then 'cancelled' else status end,updated_at=now() where id=t.id;
 elsif p_action='keep' and t.status='in-progress' then update public.trades set cancel_by='{}',updated_at=now() where id=t.id;
 elsif p_action='resume' and t.status='paused' then
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
create or replace function public.set_trade_note(p_trade uuid,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);begin
 if not private.trade_party(p_trade) or length(p_note)>1000 then raise exception 'Trade note is unavailable or too long.';end if;
 update public.trades set exchange_note=trim(p_note),updated_at=now() where id=p_trade;
end $$;
create or replace function public.send_message(p_trade uuid,p_text text) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);t public.trades;mid uuid;begin
 select * into t from public.trades where id=p_trade;
 if t.id is null or me not in(t.proposer_id,t.recipient_id) then raise exception 'Conversation unavailable.';end if;
 if private.blocked(t.proposer_id,t.recipient_id) and t.status not in('in-progress','paused') then raise exception 'This collector is unavailable.';end if;
 if length(trim(p_text)) not between 1 and 1000 then raise exception 'Messages must be 1–1000 characters.';end if;
 insert into public.trade_messages(trade_id,sender_id,text)values(t.id,me,trim(p_text)) returning id into mid;
 perform private.event(t.id,me,'message');return mid;
end $$;
create or replace function public.mark_notifications_read(p_trade uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);begin
 update public.notifications set read_at=now() where user_id=me and read_at is null and(p_trade is null or trade_id=p_trade);
end $$;
create or replace function public.review_trade(p_trade uuid,p_rating integer,p_comment text default '') returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);t public.trades;begin
 select * into t from public.trades where id=p_trade;
 if t.status<>'complete' or me not in(t.proposer_id,t.recipient_id) then raise exception 'Reviews are only for completed exchanges.';end if;
 insert into public.reviews(trade_id,reviewer_id,reviewee_id,rating,comment)values(t.id,me,case when me=t.proposer_id then t.recipient_id else t.proposer_id end,p_rating,trim(p_comment));
end $$;
create or replace function public.report_problem(p_user uuid default null,p_bottle uuid default null,p_trade uuid default null,p_reason text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);rid uuid;begin
 if length(trim(p_reason)) not between 1 and 500 then raise exception 'Describe the problem in 1–500 characters.';end if;
 if p_trade is not null and not private.trade_party(p_trade) then raise exception 'Trade unavailable.';end if;
 if p_bottle is not null and not private.can_read_bottle(p_bottle) then raise exception 'Bottle unavailable.';end if;
 insert into public.reports(reporter_id,reported_user_id,reported_bottle_id,trade_id,reason)values(me,p_user,p_bottle,p_trade,trim(p_reason))returning id into rid;
 if p_trade is not null then perform public.pause_trade(p_trade);end if;return rid;
end $$;
create or replace function public.block_collector(p_user uuid,p_block boolean default true) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 if p_user=me then raise exception 'You cannot block yourself.';end if;
 if p_block then
  insert into public.blocks(blocker_id,blocked_id)values(me,p_user) on conflict do nothing;
  update public.trades set status='declined',updated_at=now() where status='proposed' and ((proposer_id=me and recipient_id=p_user)or(proposer_id=p_user and recipient_id=me));
 else delete from public.blocks where blocker_id=me and blocked_id=p_user;end if;
end $$;
create or replace function public.expire_proposals() returns void language plpgsql security definer set search_path='' as $$
begin perform private.member_id(false);update public.trades set status='expired',updated_at=now() where status='proposed' and expires_at<=now();end $$;

create or replace function public.beta_state() returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not private.is_member() then raise exception 'An active beta invitation is required.' using errcode='42501';end if;
 return jsonb_build_object(
 'user_id',auth.uid(),'is_admin',private.is_admin(),
 'profiles',coalesce((select jsonb_agg(to_jsonb(p)) from public.profiles p),'[]'::jsonb),
 'bottles',coalesce((select jsonb_agg(to_jsonb(b) order by b.position,b.created_at) from public.bottles b where not b.archived),'[]'::jsonb),
 'shelves',coalesce((select jsonb_agg(to_jsonb(s) order by s.position,s.created_at) from public.shelves s),'[]'::jsonb),
 'trades',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from public.trades t),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.sent_at) from public.trade_messages m),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.trade_events e),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.notifications n),'[]'::jsonb),
 'jobs',coalesce((select jsonb_agg(to_jsonb(j) order by j.created_at desc) from public.capture_jobs j where j.bottle_id is null and j.status<>'expired'),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r)) from public.reviews r),'[]'::jsonb),
 'blocks',coalesce((select jsonb_agg(to_jsonb(b)) from public.blocks b),'[]'::jsonb),
 'reports',coalesce((select jsonb_agg(to_jsonb(r)) from public.reports r),'[]'::jsonb));
end $$;

create or replace function public.admin_invite(p_email text default null,p_recovery uuid default null) returns text language plpgsql security definer set search_path='' as $$
declare code text:=encode(extensions.gen_random_bytes(16),'hex');begin
 if not private.is_admin() then raise exception 'Founder access required.' using errcode='42501';end if;
 if p_recovery is null and (select count(*) from private.members)>=20 then raise exception 'The beta has reached 20 members.';end if;
 if p_recovery is not null and not exists(select 1 from private.members where user_id=p_recovery) then raise exception 'Collector not found.';end if;
 insert into private.invites(code_hash,email,purpose,target_user,created_by)values(encode(extensions.digest(code,'sha256'),'hex'),nullif(lower(trim(p_email)),''),case when p_recovery is null then 'join' else 'recovery' end,p_recovery,auth.uid());return code;
end $$;
create or replace function public.claim_invite(p_code text,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i private.invites;claim uuid:=gen_random_uuid();begin
 perform pg_advisory_xact_lock(hashtext('fraggy-invites'));
 select * into i from private.invites where code_hash=encode(extensions.digest(lower(trim(p_code)),'sha256'),'hex') for update;
 if i.id is null or i.redeemed_by is not null or i.expires_at<=now() or(i.claim_until>now())or(i.email is not null and i.email<>lower(trim(p_email)))then raise exception 'This invitation is invalid, expired, or already in use.';end if;
 if i.purpose='join' and (select count(*) from private.members)>=20 then raise exception 'The beta is full.';end if;
 update private.invites set claim_id=claim,claim_until=now()+interval '10 minutes' where id=i.id;
 return jsonb_build_object('claim',claim,'purpose',i.purpose,'user_id',i.target_user);
end $$;
create or replace function public.finish_invite(p_claim uuid,p_user uuid,p_email text,p_profile jsonb) returns void language plpgsql security definer set search_path='' as $$
declare i private.invites;founder boolean;begin
 perform pg_advisory_xact_lock(hashtext('fraggy-invites'));
 select * into i from private.invites where claim_id=p_claim and claim_until>now() and redeemed_by is null for update;
 if i.id is null then raise exception 'Invitation expired.';end if;
 if i.purpose='join' then
  if (select count(*) from private.members)>=20 then raise exception 'The beta is full.';end if;
  founder:=i.email=lower(p_email) and i.created_by is null and exists(select 1 from private.settings where key='founder_email' and lower(value)=lower(p_email)) and not exists(select 1 from private.members where is_admin);
  insert into public.profiles(id,handle,name,city,bio)values(p_user,p_profile->>'handle',trim(coalesce(p_profile->>'name','')),trim(coalesce(p_profile->>'city','')),'');
  insert into private.members(user_id,is_admin)values(p_user,founder);perform private.ensure_shelf(p_user);
 elsif i.target_user<>p_user then raise exception 'Recovery account mismatch.';end if;
 update private.invites set redeemed_by=p_user,claim_until=null where id=i.id;
end $$;
create or replace function public.release_invite(p_claim uuid) returns void language sql security definer set search_path='' as $$
 update private.invites set claim_until=null,claim_id=null where claim_id=p_claim and redeemed_by is null;
$$;
create or replace function public.admin_action(p_action text,p_id uuid,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Founder access required.' using errcode='42501';end if;
 if p_action in('suspend_user','restore_user')then
  if p_id=auth.uid() then raise exception 'You cannot suspend yourself.';end if;
  update private.members set suspended=p_action='suspend_user' where user_id=p_id;
 elsif p_action in('suspend_bottle','restore_bottle')then
  perform set_config('fraggy.trade_fn','on',true);update public.bottles set suspended=p_action='suspend_bottle' where id=p_id;
 elsif p_action='close_report'then update public.reports set status='reviewed',admin_note=left(p_note,1000)where id=p_id;
 else raise exception 'Unknown administration action.';end if;
end $$;
create or replace function public.admin_state() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin()then raise exception 'Founder access required.' using errcode='42501';end if;
 return jsonb_build_object('members',(select jsonb_agg(jsonb_build_object('id',m.user_id,'admin',m.is_admin,'suspended',m.suspended,'name',p.name,'handle',p.handle))from private.members m join public.profiles p on p.id=m.user_id),'invites',(select jsonb_agg(jsonb_build_object('id',id,'email',email,'expires_at',expires_at,'redeemed',redeemed_by is not null,'purpose',purpose))from private.invites),'reports',(select jsonb_agg(to_jsonb(r))from public.reports r),'failed_jobs',(select jsonb_agg(to_jsonb(j))from public.capture_jobs j where status='failed'),'database_bytes',pg_database_size(current_database()),'storage_bytes',(select coalesce(sum((metadata->>'size')::bigint),0)from storage.objects where bucket_id='cutouts'),'suspended_bottles',(select jsonb_agg(jsonb_build_object('id',id,'brand',brand,'name',name))from public.bottles where suspended),'worker_url',(select value from private.settings where key='worker_url'));
end $$;
create or replace function public.prepare_account_deletion() returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id(false);begin
 perform pg_advisory_xact_lock(hashtext('fraggy-trade-transitions'));
 if exists(select 1 from public.trades where me in(proposer_id,recipient_id) and status in('in-progress','paused'))then raise exception 'Resolve your accepted or paused trades before deleting this account.';end if;
 if private.is_admin() and (select count(*)from private.members where is_admin)<2 then raise exception 'Transfer founder access before deleting the founder account.';end if;
 perform set_config('fraggy.trade_fn','on',true);
 update public.trades set status='cancelled',updated_at=now()where me in(proposer_id,recipient_id)and status='proposed';
 update public.bottles set archived=true,trade_available=false where owner_id=me;
 update public.profiles set handle='@deleted_'||replace(left(me::text,18),'-',''),name='Deleted collector',city='',bio='',avatar_url=null,shelf_public=false,deleted_at=now()where id=me;
 update public.trades set exchange=exchange-me::text where me in(proposer_id,recipient_id);
 delete from private.members where user_id=me;
end $$;

create or replace function public.worker_dispatch_config() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('url',(select value from private.settings where key='worker_url'));
$$;
-- The gateway signs dispatch tickets with this server-only secret; workers still
-- have to claim a job with their independently configured token.
create or replace function public.worker_dispatch_ticket(p_job uuid) returns text language plpgsql security definer set search_path='' as $$
declare token text;begin
 token:=encode(extensions.gen_random_bytes(24),'hex');
 insert into private.settings(key,value)values('dispatch:'||p_job,encode(extensions.digest(token,'sha256'),'hex'))on conflict(key)do update set value=excluded.value;
 return token;
end $$;
create or replace function public.worker_validate_dispatch(p_job uuid,p_ticket text) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from private.settings where key='dispatch:'||p_job and value=encode(extensions.digest(p_ticket,'sha256'),'hex'));
$$;
create or replace function public.maintenance_candidates() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'original_path',j.original_path,'cutout_path',j.cutout_path)),'[]')from public.capture_jobs j where j.bottle_id is null and j.created_at<now()-interval '7 days' and j.status<>'expired';
$$;
create or replace function public.expire_capture(p_job uuid) returns void language sql security definer set search_path='' as $$
 update public.capture_jobs set status='expired',error='Capture expired. Take a new photo.'where id=p_job and bottle_id is null;
$$;

revoke execute on all functions in schema public from public,anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_member(),private.is_admin(),private.blocked(uuid,uuid),private.trade_party(uuid),private.can_read_bottle(uuid),private.can_read_media(text) to authenticated;
grant execute on function public.beta_state(),public.update_profile(jsonb),public.save_shelf(text,uuid),public.move_bottle(uuid,uuid,integer),public.edit_bottle(uuid,jsonb),public.create_capture(),public.start_capture(uuid,jsonb),public.save_capture_draft(uuid,jsonb),public.finalize_capture(uuid,jsonb,uuid),public.configure_worker(text),public.propose_trade(uuid,uuid,text),public.accept_trade(uuid),public.confirm_receipt(uuid),public.pause_trade(uuid),public.trade_action(uuid,text,jsonb),public.set_trade_note(uuid,text),public.send_message(uuid,text),public.mark_notifications_read(uuid),public.review_trade(uuid,integer,text),public.report_problem(uuid,uuid,uuid,text),public.block_collector(uuid,boolean),public.expire_proposals(),public.admin_invite(text,uuid),public.admin_action(text,uuid,text),public.admin_state(),public.prepare_account_deletion() to authenticated;
grant execute on all functions in schema public to service_role;
-- Realtime registration is idempotent and skipped on a standalone test server.
do $$declare t text;begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')then
  foreach t in array array['bottles','shelves','trades','trade_messages','notifications','capture_jobs','profiles']loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'and schemaname='public'and tablename=t)then execute format('alter publication supabase_realtime add table public.%I',t);end if;
  end loop;
 end if;
end $$;
