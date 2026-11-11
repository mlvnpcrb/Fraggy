-- Run from an authenticated operator/SQL console once the founder email is
-- confirmed. There is deliberately no "first person to sign up is admin" path.
create function public.bootstrap_founder(p_email text) returns text language plpgsql security definer set search_path='' as $$
declare code text:=encode(extensions.gen_random_bytes(16),'hex');begin
 perform pg_advisory_xact_lock(hashtext('fraggy-invites'));
 if exists(select 1 from private.members) then raise exception 'Founder bootstrap is available only before the first member joins.';end if;
 if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Use the confirmed founder email.';end if;
 insert into private.settings values('founder_email',lower(trim(p_email)))on conflict(key)do update set value=excluded.value;
 -- Only the newest bootstrap invitation can establish the founder account.
 delete from private.invites where created_by is null and redeemed_by is null;
 insert into private.invites(code_hash,email)values(encode(extensions.digest(code,'sha256'),'hex'),lower(trim(p_email)));
 return code;
end $$;
create function public.operator_recovery(p_user uuid) returns text language plpgsql security definer set search_path='' as $$
declare code text:=encode(extensions.gen_random_bytes(16),'hex');begin
 if not exists(select 1 from private.members where user_id=p_user) then raise exception 'Collector not found.';end if;
 insert into private.invites(code_hash,purpose,target_user)values(encode(extensions.digest(code,'sha256'),'hex'),'recovery',p_user);return code;
end $$;
revoke all on function public.bootstrap_founder(text),public.operator_recovery(uuid) from public,anon,authenticated;
grant execute on function public.bootstrap_founder(text),public.operator_recovery(uuid) to service_role;
