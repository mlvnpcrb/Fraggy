-- Opt-in public projection; existing member profiles and bottle rows stay private.
create table public.collector_pages (
 owner_id uuid primary key references public.profiles(id),
 enabled boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.shelf_posts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.collector_pages(owner_id),
 caption text not null check(length(caption)<=500),
 bottles jsonb not null check(jsonb_typeof(bottles)='array' and jsonb_array_length(bottles) between 1 and 6),
 created_at timestamptz not null default now(),
 removed boolean not null default false
);
create index shelf_posts_chronology on public.shelf_posts(created_at desc,id desc);
create index shelf_posts_owner on public.shelf_posts(owner_id);
create table public.collector_follows (
 follower_id uuid not null references public.collector_pages(owner_id),
 followed_id uuid not null references public.collector_pages(owner_id),
 primary key(follower_id,followed_id),check(follower_id<>followed_id)
);
create index collector_follows_target on public.collector_follows(followed_id);
create table public.post_likes (
 post_id uuid not null references public.shelf_posts(id) on delete cascade,
 owner_id uuid not null references public.collector_pages(owner_id),
 primary key(post_id,owner_id)
);
create index post_likes_owner on public.post_likes(owner_id);
create table public.post_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.shelf_posts(id) on delete cascade,
 owner_id uuid not null references public.collector_pages(owner_id),
 body text not null check(length(trim(body)) between 1 and 500),
 created_at timestamptz not null default now()
);
create index post_comments_post on public.post_comments(post_id,created_at desc);
create index post_comments_owner on public.post_comments(owner_id);

create function private.public_collector(p_owner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.collector_pages c join public.profiles p on p.id=c.owner_id join private.members m on m.user_id=p.id
 where c.owner_id=p_owner and c.enabled and p.deleted_at is null and not m.suspended and not private.blocked(auth.uid(),p_owner));
$$;
create function private.public_post(p_post uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shelf_posts p where p.id=p_post and not p.removed and private.public_collector(p.owner_id));
$$;
create function private.public_cutout(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shelf_posts p cross join lateral jsonb_array_elements(p.bottles) b
 where not p.removed and private.public_collector(p.owner_id) and b->>'image_path'=p_path);
$$;

alter table public.collector_pages enable row level security;
alter table public.shelf_posts enable row level security;
alter table public.collector_follows enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
revoke all on public.collector_pages,public.shelf_posts,public.collector_follows,public.post_likes,public.post_comments from public,anon,authenticated;
-- Read through a bounded allowlist RPC; raw tables are not exposed.
revoke all on function private.public_collector(uuid),private.public_post(uuid),private.public_cutout(text) from public;
grant execute on function private.public_cutout(text) to anon,authenticated;
grant select on storage.objects to anon;
create policy public_post_cutouts on storage.objects for select to anon,authenticated using(bucket_id='cutouts' and private.public_cutout(name));

create function public.social_read(p_owner uuid default null,p_following boolean default false,p_before timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare result jsonb; begin
 select coalesce(jsonb_agg(row.data order by row.created_at desc,row.id desc),'[]') into result from (
 select p.created_at,p.id,jsonb_build_object('id',p.id,'owner_id',p.owner_id,'caption',p.caption,'bottles',p.bottles,'created_at',p.created_at,
 'collector',jsonb_build_object('id',u.id,'handle',u.handle,'name',u.name,'bio',u.bio),
 'liked',exists(select 1 from public.post_likes l where l.post_id=p.id and l.owner_id=auth.uid()),
 'following',exists(select 1 from public.collector_follows f where f.follower_id=auth.uid() and f.followed_id=p.owner_id),
 'likes',(select count(*) from public.post_likes l where l.post_id=p.id and private.public_collector(l.owner_id)),
 'comment_count',(select count(*) from public.post_comments c where c.post_id=p.id and private.public_collector(c.owner_id)),
 'comments',coalesce((select jsonb_agg(c.data order by c.created_at,c.id) from (
 select c.created_at,c.id,jsonb_build_object('id',c.id,'owner_id',c.owner_id,'body',c.body,'handle',a.handle) data from public.post_comments c join public.profiles a on a.id=c.owner_id
 where c.post_id=p.id and private.public_collector(c.owner_id) order by c.created_at desc,c.id desc limit 30) c),'[]')) data
 from public.shelf_posts p join public.profiles u on u.id=p.owner_id
 where private.public_post(p.id) and (p_owner is null or p.owner_id=p_owner)
 and (not p_following or exists(select 1 from public.collector_follows f where f.follower_id=auth.uid() and f.followed_id=p.owner_id))
 and (p_before is null or (p.created_at,p.id)<(p_before,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
 order by p.created_at desc,p.id desc limit 20) row;
 return jsonb_build_object('posts',result,'page_enabled',coalesce((select enabled from public.collector_pages where owner_id=auth.uid()),false),
 'profile',(select jsonb_build_object('id',p.id,'handle',p.handle,'name',p.name,'bio',p.bio,
 'followers',(select count(*) from public.collector_follows f where f.followed_id=p.id and private.public_collector(f.follower_id)),
 'following',exists(select 1 from public.collector_follows f where f.follower_id=auth.uid() and f.followed_id=p.id)) from public.profiles p where p.id=p_owner and private.public_collector(p.id)));
 end $$;

create function public.social_write(p_action text,p_target uuid default null,p_text text default '',p_bottles uuid[] default '{}',p_enabled boolean default true) returns uuid language plpgsql security definer set search_path='' as $$
 declare me uuid:=private.member_id(); selected jsonb; target_owner uuid; answer uuid; begin
 -- Serialize per actor to enforce bounded writes even under concurrent requests.
 perform pg_advisory_xact_lock(hashtextextended(me::text,431));
 if p_action='page' then
  insert into public.collector_pages(owner_id,enabled) values(me,p_enabled) on conflict(owner_id) do update set enabled=excluded.enabled;
  return me;
 end if;
 if p_action='block' then perform public.block_collector(p_target,p_enabled);return p_target;end if;
 if p_action='report' then perform public.report_problem(p_target,null,null,p_text);return p_target;end if;
 if not private.public_collector(me) then raise exception 'Enable your public collector page first.';end if;
 if p_action='post' then
  if cardinality(p_bottles) not between 1 and 6 or length(p_text)>500 then raise exception 'Choose one to six bottles and a caption up to 500 characters.';end if;
  if (select count(*) from public.shelf_posts where owner_id=me and created_at>now()-interval '1 day')>=10 then raise exception 'Daily limit reached. Share another shelf tomorrow.';end if;
  select jsonb_agg(jsonb_build_object('id',b.id,'brand',b.brand,'name',b.name,'image_path',b.image_path) order by array_position(p_bottles,b.id)) into selected from public.bottles b
  where b.id=any(p_bottles) and b.owner_id=me and not b.archived and not b.suspended and b.image_kind='cutout' and b.image_path is not null;
  if jsonb_array_length(coalesce(selected,'[]'))<>cardinality(p_bottles) then raise exception 'Only your saved cutout bottles can be shared.';end if;
  insert into public.shelf_posts(owner_id,caption,bottles) values(me,trim(p_text),selected) returning id into answer;return answer;
 end if;
 if p_action='follow' then
  if p_target=me or not private.public_collector(p_target) then raise exception 'Collector unavailable.';end if;
  if p_enabled then insert into public.collector_follows values(me,p_target) on conflict do nothing;
  else delete from public.collector_follows where follower_id=me and followed_id=p_target;end if;
  return p_target;
 end if;
 if p_action='remove-comment' then
  delete from public.post_comments where id=p_target and (owner_id=me or private.is_admin() or post_id in(select id from public.shelf_posts where owner_id=me));return p_target;
 end if;
 select owner_id into target_owner from public.shelf_posts where id=p_target;
 if p_action='remove' and (target_owner=me or private.is_admin()) then update public.shelf_posts set removed=true where id=p_target;return p_target;end if;
 if not private.public_post(p_target) then raise exception 'Post unavailable.';end if;
 if p_action='like' then
  if p_enabled then insert into public.post_likes values(p_target,me) on conflict do nothing;
  else delete from public.post_likes where post_id=p_target and owner_id=me;end if;
 elsif p_action='comment' then
  if length(trim(p_text)) not between 1 and 500 then raise exception 'Write a comment up to 500 characters.';end if;
  if (select count(*) from public.post_comments where owner_id=me and created_at>now()-interval '1 hour')>=30 then raise exception 'Comment limit reached. Try again later.';end if;
  insert into public.post_comments(post_id,owner_id,body) values(p_target,me,trim(p_text)) returning id into answer;return answer;
 else raise exception 'Unknown social action.';end if;
 return p_target;
 end $$;
revoke all on function public.social_read(uuid,boolean,timestamptz,uuid),public.social_write(text,uuid,text,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.social_read(uuid,boolean,timestamptz,uuid) to anon,authenticated;
grant execute on function public.social_write(text,uuid,text,uuid[],boolean) to authenticated;

-- Historical public posts retain their own cutout version after bottle transfer/deletion.
create or replace function public.orphan_media() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(o.name),'[]') from storage.objects o where o.bucket_id='cutouts' and o.created_at<now()-interval '7 days'
 and not exists(select 1 from public.bottles b where o.name in(b.image_path,b.original_path,b.condition_path))
 and not exists(select 1 from public.profiles p where p.avatar_url=o.name)
 and not exists(select 1 from public.capture_jobs j where j.status<>'expired' and o.name in(j.original_path,j.cutout_path))
 and not exists(select 1 from public.trades t where o.name in(t.snapshot#>>'{offered,image_path}',t.snapshot#>>'{offered,original_path}',t.snapshot#>>'{offered,condition_path}',t.snapshot#>>'{requested,image_path}',t.snapshot#>>'{requested,original_path}',t.snapshot#>>'{requested,condition_path}'))
 and not exists(select 1 from public.shelf_posts p cross join lateral jsonb_array_elements(p.bottles) b where not p.removed and b->>'image_path'=o.name and exists(select 1 from private.members m where m.user_id=p.owner_id));
$$;
