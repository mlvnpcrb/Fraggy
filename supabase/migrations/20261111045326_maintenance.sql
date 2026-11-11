-- Daily cleanup runs inside the existing free Supabase project, not a paid
-- Render cron job. Credentials never appear in the scheduled command text.
insert into private.settings(key,value)values('maintenance_token',encode(extensions.gen_random_bytes(32),'hex'))on conflict do nothing;
create function public.authorize_maintenance(p_token text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.settings where key='maintenance_token' and value=p_token);
$$;
revoke all on function public.authorize_maintenance(text) from public,anon,authenticated;
grant execute on function public.authorize_maintenance(text) to service_role;
create function private.maintenance_tick() returns void language plpgsql security definer set search_path='' as $$
declare token text;begin
 select value into token from private.settings where key='maintenance_token';
 perform net.http_post(url:='https://flczhwwlvfnkqmtxpkmq.supabase.co/functions/v1/beta-gateway',headers:=jsonb_build_object('Content-Type','application/json','x-maintenance-token',token),body:='{"action":"scheduled-maintenance"}'::jsonb,timeout_milliseconds:=60000);
end $$;
revoke all on function private.maintenance_tick() from public,anon,authenticated;
do $$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') and exists(select 1 from pg_available_extensions where name='pg_net') then
  create extension if not exists pg_cron;
  create extension if not exists pg_net with schema extensions;
  perform cron.schedule('fraggy-daily-cleanup','15 19 * * *','select private.maintenance_tick()');
 end if;
end $$;
