-- Complete the original schema capture without rewriting the adopted baseline.
-- On the existing project profile_stats is already a view. The first baseline's
-- empty-development reproduction used a table; correct only that empty stand-in.
do $$begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='profile_stats' and c.relkind='r') then
  if exists(select 1 from public.profile_stats)then raise exception 'Do not replace a populated profile_stats table. Inspect the baseline first.';end if;
  create schema if not exists private;
  revoke all on schema private from public;
  alter table public.profile_stats rename to profile_stats_baseline_standin;
  alter table public.profile_stats_baseline_standin set schema private;
  create view public.profile_stats as
   select p.id,
    (select count(*)from public.bottles b where b.owner_id=p.id)as bottles_count,
    (select count(*)from public.follows f where f.followee_id=p.id)as followers_count,
    (select count(*)from public.follows f where f.follower_id=p.id)as following_count,
    (select round(avg(v.rating),1)from public.reviews v where v.reviewee_id=p.id)as rating
   from public.profiles p;
 end if;
end $$;
alter view public.profile_stats set(security_invoker=true);
create index if not exists bottles_owner_idx on public.bottles(owner_id);
create index if not exists bottles_swappable_idx on public.bottles(trade_available)where trade_available;
create index if not exists trade_messages_trade_idx on public.trade_messages(trade_id,sent_at);
