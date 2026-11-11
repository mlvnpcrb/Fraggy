-- Adopt the existing remote schema without touching its records.
-- Fresh local databases recreate the captured pre-beta schema for regression testing.
do $adopt$
begin
 if to_regclass('public.profiles') is null then
  execute $ddl$create extension if not exists pgcrypto;$ddl$;
  execute $ddl$create table public."blocks" (
 "blocker_id" uuid not null,
 "blocked_id" uuid not null,
 "created_at" timestamp with time zone default now() not null
);$ddl$;
  execute $ddl$create table public."bottles" (
 "id" uuid default gen_random_uuid() not null,
 "owner_id" uuid not null,
 "brand" text not null,
 "name" text not null,
 "size_ml" integer not null,
 "remaining_percent" integer not null,
 "image_path" text,
 "image_kind" text default 'cutout'::text not null,
 "image_width" integer,
 "image_height" integer,
 "art" text default 'amber'::text not null,
 "notes" text default ''::text not null,
 "methods" text[] default ARRAY['local'::text] not null,
 "trade_available" boolean default false not null,
 "reserved_trade_id" uuid,
 "created_at" timestamp with time zone default now() not null
);$ddl$;
  execute $ddl$create table public."follows" (
 "follower_id" uuid not null,
 "followee_id" uuid not null,
 "created_at" timestamp with time zone default now() not null
);$ddl$;
  execute $ddl$create table public."profile_stats" (
 "id" uuid,
 "bottles_count" bigint,
 "followers_count" bigint,
 "following_count" bigint,
 "rating" numeric
);$ddl$;
  execute $ddl$create table public."profiles" (
 "id" uuid not null,
 "handle" text not null,
 "name" text default ''::text not null,
 "city" text default ''::text not null,
 "bio" text default ''::text not null,
 "avatar_url" text,
 "push_token" text,
 "created_at" timestamp with time zone default now() not null
);$ddl$;
  execute $ddl$create table public."reports" (
 "id" uuid default gen_random_uuid() not null,
 "reporter_id" uuid not null,
 "reported_user_id" uuid,
 "reported_bottle_id" uuid,
 "reason" text not null,
 "status" text default 'open'::text not null,
 "created_at" timestamp with time zone default now() not null
);$ddl$;
  execute $ddl$create table public."reviews" (
 "trade_id" uuid not null,
 "reviewer_id" uuid not null,
 "reviewee_id" uuid not null,
 "rating" integer not null,
 "comment" text default ''::text not null,
 "created_at" timestamp with time zone default now() not null
);$ddl$;
  execute $ddl$create table public."trade_messages" (
 "id" uuid default gen_random_uuid() not null,
 "trade_id" uuid not null,
 "sender_id" uuid not null,
 "text" text not null,
 "sent_at" timestamp with time zone default now() not null
);$ddl$;
  execute $ddl$create table public."trades" (
 "id" uuid default gen_random_uuid() not null,
 "offered_bottle_id" uuid not null,
 "requested_bottle_id" uuid not null,
 "proposer_id" uuid not null,
 "recipient_id" uuid not null,
 "method" text not null,
 "accepted_by" uuid[] default '{}'::uuid[] not null,
 "received_by" uuid[] default '{}'::uuid[] not null,
 "status" text default 'proposed'::text not null,
 "exchange_note" text default ''::text not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);$ddl$;
  execute $ddl$alter table public."blocks" add constraint "blocks_pkey" PRIMARY KEY (blocker_id, blocked_id);$ddl$;
  execute $ddl$alter table public."bottles" add constraint "bottles_art_check" CHECK ((art = ANY (ARRAY['amber'::text, 'blue'::text, 'rose'::text, 'green'::text])));$ddl$;
  execute $ddl$alter table public."bottles" add constraint "bottles_brand_check" CHECK (((char_length(brand) >= 1) AND (char_length(brand) <= 80)));$ddl$;
  execute $ddl$alter table public."bottles" add constraint "bottles_image_kind_check" CHECK ((image_kind = ANY (ARRAY['original'::text, 'sample-cutout'::text, 'cutout'::text])));$ddl$;
  execute $ddl$alter table public."bottles" add constraint "bottles_methods_check" CHECK ((methods <@ ARRAY['local'::text, 'shipping'::text]));$ddl$;
  execute $ddl$alter table public."bottles" add constraint "bottles_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80)));$ddl$;
  execute $ddl$alter table public."bottles" add constraint "bottles_pkey" PRIMARY KEY (id);$ddl$;
  execute $ddl$alter table public."bottles" add constraint "bottles_remaining_percent_check" CHECK (((remaining_percent >= 0) AND (remaining_percent <= 100)));$ddl$;
  execute $ddl$alter table public."bottles" add constraint "bottles_size_ml_check" CHECK (((size_ml >= 1) AND (size_ml <= 1000)));$ddl$;
  execute $ddl$alter table public."follows" add constraint "follows_check" CHECK ((follower_id <> followee_id));$ddl$;
  execute $ddl$alter table public."follows" add constraint "follows_pkey" PRIMARY KEY (follower_id, followee_id);$ddl$;
  execute $ddl$alter table public."profiles" add constraint "profiles_bio_check" CHECK ((char_length(bio) <= 160));$ddl$;
  execute $ddl$alter table public."profiles" add constraint "profiles_handle_check" CHECK ((handle ~ '^@[a-z0-9._]{3,30}$'::text));$ddl$;
  execute $ddl$alter table public."profiles" add constraint "profiles_handle_key" UNIQUE (handle);$ddl$;
  execute $ddl$alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);$ddl$;
  execute $ddl$alter table public."reports" add constraint "reports_check" CHECK (((reported_user_id IS NOT NULL) OR (reported_bottle_id IS NOT NULL)));$ddl$;
  execute $ddl$alter table public."reports" add constraint "reports_pkey" PRIMARY KEY (id);$ddl$;
  execute $ddl$alter table public."reports" add constraint "reports_reason_check" CHECK (((char_length(reason) >= 1) AND (char_length(reason) <= 500)));$ddl$;
  execute $ddl$alter table public."reports" add constraint "reports_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'reviewed'::text, 'actioned'::text])));$ddl$;
  execute $ddl$alter table public."reviews" add constraint "reviews_comment_check" CHECK ((char_length(comment) <= 500));$ddl$;
  execute $ddl$alter table public."reviews" add constraint "reviews_pkey" PRIMARY KEY (trade_id, reviewer_id);$ddl$;
  execute $ddl$alter table public."reviews" add constraint "reviews_rating_check" CHECK (((rating >= 1) AND (rating <= 5)));$ddl$;
  execute $ddl$alter table public."trade_messages" add constraint "trade_messages_pkey" PRIMARY KEY (id);$ddl$;
  execute $ddl$alter table public."trade_messages" add constraint "trade_messages_text_check" CHECK (((char_length(TRIM(BOTH FROM text)) >= 1) AND (char_length(TRIM(BOTH FROM text)) <= 1000)));$ddl$;
  execute $ddl$alter table public."trades" add constraint "trades_check" CHECK ((proposer_id <> recipient_id));$ddl$;
  execute $ddl$alter table public."trades" add constraint "trades_check1" CHECK ((offered_bottle_id <> requested_bottle_id));$ddl$;
  execute $ddl$alter table public."trades" add constraint "trades_method_check" CHECK ((method = ANY (ARRAY['local'::text, 'shipping'::text])));$ddl$;
  execute $ddl$alter table public."trades" add constraint "trades_pkey" PRIMARY KEY (id);$ddl$;
  execute $ddl$alter table public."trades" add constraint "trades_status_check" CHECK ((status = ANY (ARRAY['proposed'::text, 'in-progress'::text, 'paused'::text, 'complete'::text])));$ddl$;
  execute $ddl$alter table public."blocks" add constraint "blocks_blocked_id_fkey" FOREIGN KEY (blocked_id) REFERENCES profiles(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."blocks" add constraint "blocks_blocker_id_fkey" FOREIGN KEY (blocker_id) REFERENCES profiles(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."bottles" add constraint "bottles_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."bottles" add constraint "bottles_reserved_trade_fk" FOREIGN KEY (reserved_trade_id) REFERENCES trades(id) ON DELETE SET NULL;$ddl$;
  execute $ddl$alter table public."follows" add constraint "follows_followee_id_fkey" FOREIGN KEY (followee_id) REFERENCES profiles(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."follows" add constraint "follows_follower_id_fkey" FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."reports" add constraint "reports_reported_bottle_id_fkey" FOREIGN KEY (reported_bottle_id) REFERENCES bottles(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."reports" add constraint "reports_reported_user_id_fkey" FOREIGN KEY (reported_user_id) REFERENCES profiles(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."reports" add constraint "reports_reporter_id_fkey" FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."reviews" add constraint "reviews_reviewee_id_fkey" FOREIGN KEY (reviewee_id) REFERENCES profiles(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."reviews" add constraint "reviews_reviewer_id_fkey" FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."reviews" add constraint "reviews_trade_id_fkey" FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."trade_messages" add constraint "trade_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles(id);$ddl$;
  execute $ddl$alter table public."trade_messages" add constraint "trade_messages_trade_id_fkey" FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE;$ddl$;
  execute $ddl$alter table public."trades" add constraint "trades_offered_bottle_id_fkey" FOREIGN KEY (offered_bottle_id) REFERENCES bottles(id);$ddl$;
  execute $ddl$alter table public."trades" add constraint "trades_proposer_id_fkey" FOREIGN KEY (proposer_id) REFERENCES profiles(id);$ddl$;
  execute $ddl$alter table public."trades" add constraint "trades_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES profiles(id);$ddl$;
  execute $ddl$alter table public."trades" add constraint "trades_requested_bottle_id_fkey" FOREIGN KEY (requested_bottle_id) REFERENCES bottles(id);$ddl$;
  execute $ddl$CREATE OR REPLACE FUNCTION public.accept_trade(p_trade uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  t trades; o bottles; r bottles; acc uuid[];
begin
  select * into t from trades where id = p_trade for update;
  if t.id is null or me not in (t.proposer_id, t.recipient_id) then
    raise exception 'Only these two collectors can confirm this trade.';
  end if;
  if t.status in ('paused', 'complete') then raise exception 'This trade cannot be accepted.'; end if;
  if t.status = 'in-progress' then return; end if;
  select * into o from bottles where id = t.offered_bottle_id for update;
  select * into r from bottles where id = t.requested_bottle_id for update;
  if o.owner_id <> t.proposer_id or r.owner_id <> t.recipient_id then
    raise exception 'The bottle owner has changed. Start a new offer.';
  end if;
  if not o.trade_available or not r.trade_available
     or (o.reserved_trade_id is not null and o.reserved_trade_id <> t.id)
     or (r.reserved_trade_id is not null and r.reserved_trade_id <> t.id) then
    raise exception 'A bottle has been reserved for another trade.';
  end if;
  acc := array(select distinct unnest(t.accepted_by || me));
  if t.proposer_id = any (acc) and t.recipient_id = any (acc) then
    perform set_config('fraggy.trade_fn', 'on', true);
    update bottles set reserved_trade_id = t.id where id in (o.id, r.id);
    update trades set accepted_by = acc, status = 'in-progress', updated_at = now() where id = t.id;
  else
    update trades set accepted_by = acc, updated_at = now() where id = t.id;
  end if;
end;
$function$
;$ddl$;
  execute $ddl$CREATE OR REPLACE FUNCTION public.confirm_receipt(p_trade uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  t trades; rec uuid[];
begin
  select * into t from trades where id = p_trade for update;
  if t.id is null or me not in (t.proposer_id, t.recipient_id) then
    raise exception 'Only these two collectors can confirm this trade.';
  end if;
  if t.status = 'complete' then return; end if;
  if t.status <> 'in-progress' then
    raise exception 'Both collectors must accept before confirming receipt.';
  end if;
  if exists (
    select 1 from bottles
    where id in (t.offered_bottle_id, t.requested_bottle_id)
      and reserved_trade_id is distinct from t.id
  ) then
    raise exception 'The bottle reservation has changed.';
  end if;
  rec := array(select distinct unnest(t.received_by || me));
  if t.proposer_id = any (rec) and t.recipient_id = any (rec) then
    perform set_config('fraggy.trade_fn', 'on', true);
    update bottles set owner_id = t.recipient_id, reserved_trade_id = null, trade_available = false
      where id = t.offered_bottle_id;
    update bottles set owner_id = t.proposer_id, reserved_trade_id = null, trade_available = false
      where id = t.requested_bottle_id;
    update trades set received_by = rec, status = 'complete', updated_at = now() where id = t.id;
  else
    update trades set received_by = rec, updated_at = now() where id = t.id;
  end if;
end;
$function$
;$ddl$;
  execute $ddl$CREATE OR REPLACE FUNCTION public.guard_bottle_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if current_setting('fraggy.trade_fn', true) is distinct from 'on' then
    if new.owner_id <> old.owner_id or new.reserved_trade_id is distinct from old.reserved_trade_id then
      raise exception 'Ownership and reservations change only through trades.';
    end if;
  end if;
  return new;
end;
$function$
;$ddl$;
  execute $ddl$CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$function$
;$ddl$;
  execute $ddl$CREATE OR REPLACE FUNCTION public.is_trade_party(t uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from trades where id = t and auth.uid() in (proposer_id, recipient_id)
  );
$function$
;$ddl$;
  execute $ddl$CREATE OR REPLACE FUNCTION public.pause_trade(p_trade uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t trades;
begin
  select * into t from trades where id = p_trade for update;
  if t.id is null or auth.uid() not in (t.proposer_id, t.recipient_id) then
    raise exception 'Only these two collectors can change this trade.';
  end if;
  if t.status = 'complete' then raise exception 'Completed trades cannot be paused.'; end if;
  perform set_config('fraggy.trade_fn', 'on', true);
  update bottles set reserved_trade_id = null where reserved_trade_id = t.id;
  update trades set status = 'paused', updated_at = now() where id = t.id;
end;
$function$
;$ddl$;
  execute $ddl$CREATE OR REPLACE FUNCTION public.propose_trade(p_offered uuid, p_requested uuid, p_method text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  o bottles; r bottles; new_id uuid;
begin
  select * into o from bottles where id = p_offered for update;
  select * into r from bottles where id = p_requested for update;
  if o.id is null or r.id is null then raise exception 'A bottle is no longer available.'; end if;
  if o.owner_id <> me or r.owner_id = me then
    raise exception 'Choose one of your bottles and one from another collector.';
  end if;
  if is_blocked_between(me, r.owner_id) then raise exception 'This collector is unavailable.'; end if;
  if not o.trade_available or o.reserved_trade_id is not null
     or not r.trade_available or r.reserved_trade_id is not null then
    raise exception 'This bottle is not available to swap.';
  end if;
  if not (p_method = any (o.methods)) or not (p_method = any (r.methods)) then
    raise exception 'Choose an exchange method both collectors offer.';
  end if;
  insert into trades (offered_bottle_id, requested_bottle_id, proposer_id, recipient_id, method, accepted_by)
  values (o.id, r.id, me, r.owner_id, p_method, array[me])
  returning id into new_id;
  return new_id;
end;
$function$
;$ddl$;
  execute $ddl$CREATE OR REPLACE FUNCTION public.set_trade_note(p_trade uuid, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_trade_party(p_trade) then raise exception 'Only these two collectors can change this trade.'; end if;
  update trades set exchange_note = trim(p_note), updated_at = now() where id = p_trade;
end;
$function$
;$ddl$;
  execute $ddl$CREATE TRIGGER bottles_guard BEFORE UPDATE ON public.bottles FOR EACH ROW EXECUTE FUNCTION guard_bottle_update();$ddl$;
  execute $ddl$alter table public."blocks" enable row level security;$ddl$;
  execute $ddl$alter table public."bottles" enable row level security;$ddl$;
  execute $ddl$alter table public."follows" enable row level security;$ddl$;
  execute $ddl$alter table public."profile_stats" enable row level security;$ddl$;
  execute $ddl$alter table public."profiles" enable row level security;$ddl$;
  execute $ddl$alter table public."reports" enable row level security;$ddl$;
  execute $ddl$alter table public."reviews" enable row level security;$ddl$;
  execute $ddl$alter table public."trade_messages" enable row level security;$ddl$;
  execute $ddl$alter table public."trades" enable row level security;$ddl$;
  execute $ddl$create policy "cutouts_delete_own" on "storage"."objects" as PERMISSIVE for DELETE to "public" using (((bucket_id = 'cutouts'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));$ddl$;
  execute $ddl$create policy "cutouts_write_own" on "storage"."objects" as PERMISSIVE for INSERT to "public" with check (((bucket_id = 'cutouts'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));$ddl$;
  execute $ddl$create policy "cutouts_read" on "storage"."objects" as PERMISSIVE for SELECT to "public" using ((bucket_id = 'cutouts'::text));$ddl$;
  execute $ddl$create policy "profiles_update_self" on "public"."profiles" as PERMISSIVE for UPDATE to "public" using ((id = auth.uid())) with check ((id = auth.uid()));$ddl$;
  execute $ddl$create policy "profiles_insert_self" on "public"."profiles" as PERMISSIVE for INSERT to "public" with check ((id = auth.uid()));$ddl$;
  execute $ddl$create policy "profiles_read" on "public"."profiles" as PERMISSIVE for SELECT to "public" using ((NOT is_blocked_between(auth.uid(), id)));$ddl$;
  execute $ddl$create policy "bottles_delete_own" on "public"."bottles" as PERMISSIVE for DELETE to "public" using (((owner_id = auth.uid()) AND (reserved_trade_id IS NULL)));$ddl$;
  execute $ddl$create policy "bottles_update_own" on "public"."bottles" as PERMISSIVE for UPDATE to "public" using ((owner_id = auth.uid())) with check ((owner_id = auth.uid()));$ddl$;
  execute $ddl$create policy "bottles_insert_own" on "public"."bottles" as PERMISSIVE for INSERT to "public" with check (((owner_id = auth.uid()) AND (reserved_trade_id IS NULL)));$ddl$;
  execute $ddl$create policy "bottles_read" on "public"."bottles" as PERMISSIVE for SELECT to "public" using ((NOT is_blocked_between(auth.uid(), owner_id)));$ddl$;
  execute $ddl$create policy "follows_delete_self" on "public"."follows" as PERMISSIVE for DELETE to "public" using ((follower_id = auth.uid()));$ddl$;
  execute $ddl$create policy "follows_insert_self" on "public"."follows" as PERMISSIVE for INSERT to "public" with check (((follower_id = auth.uid()) AND (NOT is_blocked_between(follower_id, followee_id))));$ddl$;
  execute $ddl$create policy "follows_read" on "public"."follows" as PERMISSIVE for SELECT to "public" using (true);$ddl$;
  execute $ddl$create policy "trades_read_party" on "public"."trades" as PERMISSIVE for SELECT to "public" using (((auth.uid() = proposer_id) OR (auth.uid() = recipient_id)));$ddl$;
  execute $ddl$create policy "messages_insert_party" on "public"."trade_messages" as PERMISSIVE for INSERT to "public" with check (((sender_id = auth.uid()) AND is_trade_party(trade_id)));$ddl$;
  execute $ddl$create policy "messages_read_party" on "public"."trade_messages" as PERMISSIVE for SELECT to "public" using (is_trade_party(trade_id));$ddl$;
  execute $ddl$create policy "blocks_own" on "public"."blocks" as PERMISSIVE for ALL to "public" using ((blocker_id = auth.uid())) with check ((blocker_id = auth.uid()));$ddl$;
  execute $ddl$create policy "reports_read_own" on "public"."reports" as PERMISSIVE for SELECT to "public" using ((reporter_id = auth.uid()));$ddl$;
  execute $ddl$create policy "reports_insert_own" on "public"."reports" as PERMISSIVE for INSERT to "public" with check ((reporter_id = auth.uid()));$ddl$;
  execute $ddl$create policy "reviews_insert_party" on "public"."reviews" as PERMISSIVE for INSERT to "public" with check (((reviewer_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM trades t
  WHERE ((t.id = reviews.trade_id) AND (t.status = 'complete'::text) AND ((auth.uid() = t.proposer_id) OR (auth.uid() = t.recipient_id)) AND ((reviews.reviewee_id = t.proposer_id) OR (reviews.reviewee_id = t.recipient_id)) AND (reviews.reviewee_id <> auth.uid()))))));$ddl$;
  execute $ddl$create policy "reviews_read" on "public"."reviews" as PERMISSIVE for SELECT to "public" using (true);$ddl$;
  execute $ddl$grant INSERT on public."profiles" to "postgres";$ddl$;
  execute $ddl$grant SELECT on public."profiles" to "postgres";$ddl$;
  execute $ddl$grant UPDATE on public."profiles" to "postgres";$ddl$;
  execute $ddl$grant DELETE on public."profiles" to "postgres";$ddl$;
  execute $ddl$grant TRUNCATE on public."profiles" to "postgres";$ddl$;
  execute $ddl$grant REFERENCES on public."profiles" to "postgres";$ddl$;
  execute $ddl$grant TRIGGER on public."profiles" to "postgres";$ddl$;
  execute $ddl$grant INSERT on public."profiles" to "anon";$ddl$;
  execute $ddl$grant SELECT on public."profiles" to "anon";$ddl$;
  execute $ddl$grant UPDATE on public."profiles" to "anon";$ddl$;
  execute $ddl$grant DELETE on public."profiles" to "anon";$ddl$;
  execute $ddl$grant TRUNCATE on public."profiles" to "anon";$ddl$;
  execute $ddl$grant REFERENCES on public."profiles" to "anon";$ddl$;
  execute $ddl$grant TRIGGER on public."profiles" to "anon";$ddl$;
  execute $ddl$grant INSERT on public."profiles" to "authenticated";$ddl$;
  execute $ddl$grant SELECT on public."profiles" to "authenticated";$ddl$;
  execute $ddl$grant UPDATE on public."profiles" to "authenticated";$ddl$;
  execute $ddl$grant DELETE on public."profiles" to "authenticated";$ddl$;
  execute $ddl$grant TRUNCATE on public."profiles" to "authenticated";$ddl$;
  execute $ddl$grant REFERENCES on public."profiles" to "authenticated";$ddl$;
  execute $ddl$grant TRIGGER on public."profiles" to "authenticated";$ddl$;
  execute $ddl$grant INSERT on public."profiles" to "service_role";$ddl$;
  execute $ddl$grant SELECT on public."profiles" to "service_role";$ddl$;
  execute $ddl$grant UPDATE on public."profiles" to "service_role";$ddl$;
  execute $ddl$grant DELETE on public."profiles" to "service_role";$ddl$;
  execute $ddl$grant TRUNCATE on public."profiles" to "service_role";$ddl$;
  execute $ddl$grant REFERENCES on public."profiles" to "service_role";$ddl$;
  execute $ddl$grant TRIGGER on public."profiles" to "service_role";$ddl$;
  execute $ddl$grant INSERT on public."bottles" to "postgres";$ddl$;
  execute $ddl$grant SELECT on public."bottles" to "postgres";$ddl$;
  execute $ddl$grant UPDATE on public."bottles" to "postgres";$ddl$;
  execute $ddl$grant DELETE on public."bottles" to "postgres";$ddl$;
  execute $ddl$grant TRUNCATE on public."bottles" to "postgres";$ddl$;
  execute $ddl$grant REFERENCES on public."bottles" to "postgres";$ddl$;
  execute $ddl$grant TRIGGER on public."bottles" to "postgres";$ddl$;
  execute $ddl$grant INSERT on public."bottles" to "anon";$ddl$;
  execute $ddl$grant SELECT on public."bottles" to "anon";$ddl$;
  execute $ddl$grant UPDATE on public."bottles" to "anon";$ddl$;
  execute $ddl$grant DELETE on public."bottles" to "anon";$ddl$;
  execute $ddl$grant TRUNCATE on public."bottles" to "anon";$ddl$;
  execute $ddl$grant REFERENCES on public."bottles" to "anon";$ddl$;
  execute $ddl$grant TRIGGER on public."bottles" to "anon";$ddl$;
  execute $ddl$grant INSERT on public."bottles" to "authenticated";$ddl$;
  execute $ddl$grant SELECT on public."bottles" to "authenticated";$ddl$;
  execute $ddl$grant UPDATE on public."bottles" to "authenticated";$ddl$;
  execute $ddl$grant DELETE on public."bottles" to "authenticated";$ddl$;
  execute $ddl$grant TRUNCATE on public."bottles" to "authenticated";$ddl$;
  execute $ddl$grant REFERENCES on public."bottles" to "authenticated";$ddl$;
  execute $ddl$grant TRIGGER on public."bottles" to "authenticated";$ddl$;
  execute $ddl$grant INSERT on public."bottles" to "service_role";$ddl$;
  execute $ddl$grant SELECT on public."bottles" to "service_role";$ddl$;
  execute $ddl$grant UPDATE on public."bottles" to "service_role";$ddl$;
  execute $ddl$grant DELETE on public."bottles" to "service_role";$ddl$;
  execute $ddl$grant TRUNCATE on public."bottles" to "service_role";$ddl$;
  execute $ddl$grant REFERENCES on public."bottles" to "service_role";$ddl$;
  execute $ddl$grant TRIGGER on public."bottles" to "service_role";$ddl$;
  execute $ddl$grant INSERT on public."follows" to "postgres";$ddl$;
  execute $ddl$grant SELECT on public."follows" to "postgres";$ddl$;
  execute $ddl$grant UPDATE on public."follows" to "postgres";$ddl$;
  execute $ddl$grant DELETE on public."follows" to "postgres";$ddl$;
  execute $ddl$grant TRUNCATE on public."follows" to "postgres";$ddl$;
  execute $ddl$grant REFERENCES on public."follows" to "postgres";$ddl$;
  execute $ddl$grant TRIGGER on public."follows" to "postgres";$ddl$;
  execute $ddl$grant INSERT on public."follows" to "anon";$ddl$;
  execute $ddl$grant SELECT on public."follows" to "anon";$ddl$;
  execute $ddl$grant UPDATE on public."follows" to "anon";$ddl$;
  execute $ddl$grant DELETE on public."follows" to "anon";$ddl$;
  execute $ddl$grant TRUNCATE on public."follows" to "anon";$ddl$;
  execute $ddl$grant REFERENCES on public."follows" to "anon";$ddl$;
  execute $ddl$grant TRIGGER on public."follows" to "anon";$ddl$;
  execute $ddl$grant INSERT on public."follows" to "authenticated";$ddl$;
  execute $ddl$grant SELECT on public."follows" to "authenticated";$ddl$;
  execute $ddl$grant UPDATE on public."follows" to "authenticated";$ddl$;
  execute $ddl$grant DELETE on public."follows" to "authenticated";$ddl$;
  execute $ddl$grant TRUNCATE on public."follows" to "authenticated";$ddl$;
  execute $ddl$grant REFERENCES on public."follows" to "authenticated";$ddl$;
  execute $ddl$grant TRIGGER on public."follows" to "authenticated";$ddl$;
  execute $ddl$grant INSERT on public."follows" to "service_role";$ddl$;
  execute $ddl$grant SELECT on public."follows" to "service_role";$ddl$;
  execute $ddl$grant UPDATE on public."follows" to "service_role";$ddl$;
  execute $ddl$grant DELETE on public."follows" to "service_role";$ddl$;
  execute $ddl$grant TRUNCATE on public."follows" to "service_role";$ddl$;
  execute $ddl$grant REFERENCES on public."follows" to "service_role";$ddl$;
  execute $ddl$grant TRIGGER on public."follows" to "service_role";$ddl$;
  execute $ddl$grant INSERT on public."trades" to "postgres";$ddl$;
  execute $ddl$grant SELECT on public."trades" to "postgres";$ddl$;
  execute $ddl$grant UPDATE on public."trades" to "postgres";$ddl$;
  execute $ddl$grant DELETE on public."trades" to "postgres";$ddl$;
  execute $ddl$grant TRUNCATE on public."trades" to "postgres";$ddl$;
  execute $ddl$grant REFERENCES on public."trades" to "postgres";$ddl$;
  execute $ddl$grant TRIGGER on public."trades" to "postgres";$ddl$;
  execute $ddl$grant INSERT on public."trades" to "anon";$ddl$;
  execute $ddl$grant SELECT on public."trades" to "anon";$ddl$;
  execute $ddl$grant UPDATE on public."trades" to "anon";$ddl$;
  execute $ddl$grant DELETE on public."trades" to "anon";$ddl$;
  execute $ddl$grant TRUNCATE on public."trades" to "anon";$ddl$;
  execute $ddl$grant REFERENCES on public."trades" to "anon";$ddl$;
  execute $ddl$grant TRIGGER on public."trades" to "anon";$ddl$;
  execute $ddl$grant INSERT on public."trades" to "authenticated";$ddl$;
  execute $ddl$grant SELECT on public."trades" to "authenticated";$ddl$;
  execute $ddl$grant UPDATE on public."trades" to "authenticated";$ddl$;
  execute $ddl$grant DELETE on public."trades" to "authenticated";$ddl$;
  execute $ddl$grant TRUNCATE on public."trades" to "authenticated";$ddl$;
  execute $ddl$grant REFERENCES on public."trades" to "authenticated";$ddl$;
  execute $ddl$grant TRIGGER on public."trades" to "authenticated";$ddl$;
  execute $ddl$grant INSERT on public."trades" to "service_role";$ddl$;
  execute $ddl$grant SELECT on public."trades" to "service_role";$ddl$;
  execute $ddl$grant UPDATE on public."trades" to "service_role";$ddl$;
  execute $ddl$grant DELETE on public."trades" to "service_role";$ddl$;
  execute $ddl$grant TRUNCATE on public."trades" to "service_role";$ddl$;
  execute $ddl$grant REFERENCES on public."trades" to "service_role";$ddl$;
  execute $ddl$grant TRIGGER on public."trades" to "service_role";$ddl$;
  execute $ddl$grant INSERT on public."trade_messages" to "postgres";$ddl$;
  execute $ddl$grant SELECT on public."trade_messages" to "postgres";$ddl$;
  execute $ddl$grant UPDATE on public."trade_messages" to "postgres";$ddl$;
  execute $ddl$grant DELETE on public."trade_messages" to "postgres";$ddl$;
  execute $ddl$grant TRUNCATE on public."trade_messages" to "postgres";$ddl$;
  execute $ddl$grant REFERENCES on public."trade_messages" to "postgres";$ddl$;
  execute $ddl$grant TRIGGER on public."trade_messages" to "postgres";$ddl$;
  execute $ddl$grant INSERT on public."trade_messages" to "anon";$ddl$;
  execute $ddl$grant SELECT on public."trade_messages" to "anon";$ddl$;
  execute $ddl$grant UPDATE on public."trade_messages" to "anon";$ddl$;
  execute $ddl$grant DELETE on public."trade_messages" to "anon";$ddl$;
  execute $ddl$grant TRUNCATE on public."trade_messages" to "anon";$ddl$;
  execute $ddl$grant REFERENCES on public."trade_messages" to "anon";$ddl$;
  execute $ddl$grant TRIGGER on public."trade_messages" to "anon";$ddl$;
  execute $ddl$grant INSERT on public."trade_messages" to "authenticated";$ddl$;
  execute $ddl$grant SELECT on public."trade_messages" to "authenticated";$ddl$;
  execute $ddl$grant UPDATE on public."trade_messages" to "authenticated";$ddl$;
  execute $ddl$grant DELETE on public."trade_messages" to "authenticated";$ddl$;
  execute $ddl$grant TRUNCATE on public."trade_messages" to "authenticated";$ddl$;
  execute $ddl$grant REFERENCES on public."trade_messages" to "authenticated";$ddl$;
  execute $ddl$grant TRIGGER on public."trade_messages" to "authenticated";$ddl$;
  execute $ddl$grant INSERT on public."trade_messages" to "service_role";$ddl$;
  execute $ddl$grant SELECT on public."trade_messages" to "service_role";$ddl$;
  execute $ddl$grant UPDATE on public."trade_messages" to "service_role";$ddl$;
  execute $ddl$grant DELETE on public."trade_messages" to "service_role";$ddl$;
  execute $ddl$grant TRUNCATE on public."trade_messages" to "service_role";$ddl$;
  execute $ddl$grant REFERENCES on public."trade_messages" to "service_role";$ddl$;
  execute $ddl$grant TRIGGER on public."trade_messages" to "service_role";$ddl$;
  execute $ddl$grant INSERT on public."blocks" to "postgres";$ddl$;
  execute $ddl$grant SELECT on public."blocks" to "postgres";$ddl$;
  execute $ddl$grant UPDATE on public."blocks" to "postgres";$ddl$;
  execute $ddl$grant DELETE on public."blocks" to "postgres";$ddl$;
  execute $ddl$grant TRUNCATE on public."blocks" to "postgres";$ddl$;
  execute $ddl$grant REFERENCES on public."blocks" to "postgres";$ddl$;
  execute $ddl$grant TRIGGER on public."blocks" to "postgres";$ddl$;
  execute $ddl$grant INSERT on public."blocks" to "anon";$ddl$;
  execute $ddl$grant SELECT on public."blocks" to "anon";$ddl$;
  execute $ddl$grant UPDATE on public."blocks" to "anon";$ddl$;
  execute $ddl$grant DELETE on public."blocks" to "anon";$ddl$;
  execute $ddl$grant TRUNCATE on public."blocks" to "anon";$ddl$;
  execute $ddl$grant REFERENCES on public."blocks" to "anon";$ddl$;
  execute $ddl$grant TRIGGER on public."blocks" to "anon";$ddl$;
  execute $ddl$grant INSERT on public."blocks" to "authenticated";$ddl$;
  execute $ddl$grant SELECT on public."blocks" to "authenticated";$ddl$;
  execute $ddl$grant UPDATE on public."blocks" to "authenticated";$ddl$;
  execute $ddl$grant DELETE on public."blocks" to "authenticated";$ddl$;
  execute $ddl$grant TRUNCATE on public."blocks" to "authenticated";$ddl$;
  execute $ddl$grant REFERENCES on public."blocks" to "authenticated";$ddl$;
  execute $ddl$grant TRIGGER on public."blocks" to "authenticated";$ddl$;
  execute $ddl$grant INSERT on public."blocks" to "service_role";$ddl$;
  execute $ddl$grant SELECT on public."blocks" to "service_role";$ddl$;
  execute $ddl$grant UPDATE on public."blocks" to "service_role";$ddl$;
  execute $ddl$grant DELETE on public."blocks" to "service_role";$ddl$;
  execute $ddl$grant TRUNCATE on public."blocks" to "service_role";$ddl$;
  execute $ddl$grant REFERENCES on public."blocks" to "service_role";$ddl$;
  execute $ddl$grant TRIGGER on public."blocks" to "service_role";$ddl$;
  execute $ddl$grant INSERT on public."reports" to "postgres";$ddl$;
  execute $ddl$grant SELECT on public."reports" to "postgres";$ddl$;
  execute $ddl$grant UPDATE on public."reports" to "postgres";$ddl$;
  execute $ddl$grant DELETE on public."reports" to "postgres";$ddl$;
  execute $ddl$grant TRUNCATE on public."reports" to "postgres";$ddl$;
  execute $ddl$grant REFERENCES on public."reports" to "postgres";$ddl$;
  execute $ddl$grant TRIGGER on public."reports" to "postgres";$ddl$;
  execute $ddl$grant INSERT on public."reports" to "anon";$ddl$;
  execute $ddl$grant SELECT on public."reports" to "anon";$ddl$;
  execute $ddl$grant UPDATE on public."reports" to "anon";$ddl$;
  execute $ddl$grant DELETE on public."reports" to "anon";$ddl$;
  execute $ddl$grant TRUNCATE on public."reports" to "anon";$ddl$;
  execute $ddl$grant REFERENCES on public."reports" to "anon";$ddl$;
  execute $ddl$grant TRIGGER on public."reports" to "anon";$ddl$;
  execute $ddl$grant INSERT on public."reports" to "authenticated";$ddl$;
  execute $ddl$grant SELECT on public."reports" to "authenticated";$ddl$;
  execute $ddl$grant UPDATE on public."reports" to "authenticated";$ddl$;
  execute $ddl$grant DELETE on public."reports" to "authenticated";$ddl$;
  execute $ddl$grant TRUNCATE on public."reports" to "authenticated";$ddl$;
  execute $ddl$grant REFERENCES on public."reports" to "authenticated";$ddl$;
  execute $ddl$grant TRIGGER on public."reports" to "authenticated";$ddl$;
  execute $ddl$grant INSERT on public."reports" to "service_role";$ddl$;
  execute $ddl$grant SELECT on public."reports" to "service_role";$ddl$;
  execute $ddl$grant UPDATE on public."reports" to "service_role";$ddl$;
  execute $ddl$grant DELETE on public."reports" to "service_role";$ddl$;
  execute $ddl$grant TRUNCATE on public."reports" to "service_role";$ddl$;
  execute $ddl$grant REFERENCES on public."reports" to "service_role";$ddl$;
  execute $ddl$grant TRIGGER on public."reports" to "service_role";$ddl$;
  execute $ddl$grant INSERT on public."reviews" to "postgres";$ddl$;
  execute $ddl$grant SELECT on public."reviews" to "postgres";$ddl$;
  execute $ddl$grant UPDATE on public."reviews" to "postgres";$ddl$;
  execute $ddl$grant DELETE on public."reviews" to "postgres";$ddl$;
  execute $ddl$grant TRUNCATE on public."reviews" to "postgres";$ddl$;
  execute $ddl$grant REFERENCES on public."reviews" to "postgres";$ddl$;
  execute $ddl$grant TRIGGER on public."reviews" to "postgres";$ddl$;
  execute $ddl$grant INSERT on public."reviews" to "anon";$ddl$;
  execute $ddl$grant SELECT on public."reviews" to "anon";$ddl$;
  execute $ddl$grant UPDATE on public."reviews" to "anon";$ddl$;
  execute $ddl$grant DELETE on public."reviews" to "anon";$ddl$;
  execute $ddl$grant TRUNCATE on public."reviews" to "anon";$ddl$;
  execute $ddl$grant REFERENCES on public."reviews" to "anon";$ddl$;
  execute $ddl$grant TRIGGER on public."reviews" to "anon";$ddl$;
  execute $ddl$grant INSERT on public."reviews" to "authenticated";$ddl$;
  execute $ddl$grant SELECT on public."reviews" to "authenticated";$ddl$;
  execute $ddl$grant UPDATE on public."reviews" to "authenticated";$ddl$;
  execute $ddl$grant DELETE on public."reviews" to "authenticated";$ddl$;
  execute $ddl$grant TRUNCATE on public."reviews" to "authenticated";$ddl$;
  execute $ddl$grant REFERENCES on public."reviews" to "authenticated";$ddl$;
  execute $ddl$grant TRIGGER on public."reviews" to "authenticated";$ddl$;
  execute $ddl$grant INSERT on public."reviews" to "service_role";$ddl$;
  execute $ddl$grant SELECT on public."reviews" to "service_role";$ddl$;
  execute $ddl$grant UPDATE on public."reviews" to "service_role";$ddl$;
  execute $ddl$grant DELETE on public."reviews" to "service_role";$ddl$;
  execute $ddl$grant TRUNCATE on public."reviews" to "service_role";$ddl$;
  execute $ddl$grant REFERENCES on public."reviews" to "service_role";$ddl$;
  execute $ddl$grant TRIGGER on public."reviews" to "service_role";$ddl$;
  execute $ddl$grant INSERT on public."profile_stats" to "postgres";$ddl$;
  execute $ddl$grant SELECT on public."profile_stats" to "postgres";$ddl$;
  execute $ddl$grant UPDATE on public."profile_stats" to "postgres";$ddl$;
  execute $ddl$grant DELETE on public."profile_stats" to "postgres";$ddl$;
  execute $ddl$grant TRUNCATE on public."profile_stats" to "postgres";$ddl$;
  execute $ddl$grant REFERENCES on public."profile_stats" to "postgres";$ddl$;
  execute $ddl$grant TRIGGER on public."profile_stats" to "postgres";$ddl$;
  execute $ddl$grant INSERT on public."profile_stats" to "anon";$ddl$;
  execute $ddl$grant SELECT on public."profile_stats" to "anon";$ddl$;
  execute $ddl$grant UPDATE on public."profile_stats" to "anon";$ddl$;
  execute $ddl$grant DELETE on public."profile_stats" to "anon";$ddl$;
  execute $ddl$grant TRUNCATE on public."profile_stats" to "anon";$ddl$;
  execute $ddl$grant REFERENCES on public."profile_stats" to "anon";$ddl$;
  execute $ddl$grant TRIGGER on public."profile_stats" to "anon";$ddl$;
  execute $ddl$grant INSERT on public."profile_stats" to "authenticated";$ddl$;
  execute $ddl$grant SELECT on public."profile_stats" to "authenticated";$ddl$;
  execute $ddl$grant UPDATE on public."profile_stats" to "authenticated";$ddl$;
  execute $ddl$grant DELETE on public."profile_stats" to "authenticated";$ddl$;
  execute $ddl$grant TRUNCATE on public."profile_stats" to "authenticated";$ddl$;
  execute $ddl$grant REFERENCES on public."profile_stats" to "authenticated";$ddl$;
  execute $ddl$grant TRIGGER on public."profile_stats" to "authenticated";$ddl$;
  execute $ddl$grant INSERT on public."profile_stats" to "service_role";$ddl$;
  execute $ddl$grant SELECT on public."profile_stats" to "service_role";$ddl$;
  execute $ddl$grant UPDATE on public."profile_stats" to "service_role";$ddl$;
  execute $ddl$grant DELETE on public."profile_stats" to "service_role";$ddl$;
  execute $ddl$grant TRUNCATE on public."profile_stats" to "service_role";$ddl$;
  execute $ddl$grant REFERENCES on public."profile_stats" to "service_role";$ddl$;
  execute $ddl$grant TRIGGER on public."profile_stats" to "service_role";$ddl$;
 end if;
end $adopt$;

