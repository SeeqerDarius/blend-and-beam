-- Staff roles cannot be assigned to existing customer accounts through the
-- authenticated RPC. New staff roles are reserved by the server-side invite
-- workflow using the service role key. This RPC remains available for removal.
create or replace function private.assign_staff(p_email text,p_role uuid,p_remove boolean) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if not private.has_permission('staff.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 if not p_remove then raise exception 'Staff roles can only be assigned through an invitation' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(817423);
 select id into target from auth.users where lower(email)=lower(trim(p_email));
 if target is null then raise exception 'Account not found'; end if;
 if target=auth.uid() then raise exception 'You cannot change your own roles'; end if;
 if not exists(select 1 from public.roles where id=p_role) then raise exception 'Role not found'; end if;
 if exists(select 1 from public.roles where id=p_role and name='Super Admin') and (select count(*) from public.user_roles where role_id=p_role)<=1 then raise exception 'The last owner cannot be removed'; end if;
 delete from public.user_roles where user_id=target and role_id=p_role;
end $$;
