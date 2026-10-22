-- Staff invitation actions use the Supabase service role to check whether an
-- email already belongs to a customer and to reserve an invitation-only role.
-- Those privileges were revoked when public table access was hardened, which
-- made the server-side account check fail before an invite could be sent.
grant select on public.profiles to service_role;
grant select, insert, update on public.user_roles to service_role;
