create function public.retry_capture(p_job uuid,p_draft jsonb default '{}') returns public.capture_jobs language plpgsql security definer set search_path='' as $$
declare me uuid:=private.member_id();j public.capture_jobs;begin
 select * into j from public.capture_jobs where id=p_job and owner_id=me for update;
 if j.id is null or j.bottle_id is not null or j.status='expired' then raise exception 'Capture is unavailable.';end if;
 if j.status='processing' and j.lease_until>now() then raise exception 'Processing is still running. Wait for the result.';end if;
 update public.capture_jobs set status='failed',error=null where id=p_job;
 return public.start_capture(p_job,p_draft);
end $$;
revoke all on function public.retry_capture(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.retry_capture(uuid,jsonb) to authenticated,service_role;
