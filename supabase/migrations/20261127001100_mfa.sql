-- =====================================================================
-- WargaKu · Migration 0011 · Verifikasi 2 langkah (TOTP)
-- Ketua RT dan Bendahara WAJIB memakai verifikasi 2 langkah; peran lain
-- boleh mengaktifkannya sendiri. Akun yang wajib (atau sudah punya
-- authenticator terverifikasi) hanya bisa membaca/mengubah data bila
-- sesinya sudah naik ke aal2 (kode authenticator sudah dimasukkan).
-- Ditegakkan di database, bukan hanya di tampilan:
--   1. policy RESTRICTIVE di setiap tabel public ber-RLS;
--   2. helper has_rt_role / is_rt_member / my_household_ids (dipakai
--      view & RPC SECURITY DEFINER yang melewati RLS).
-- =====================================================================

create or replace function public.mfa_required()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.user_memberships m
           where m.user_id = (select auth.uid()) and m.is_active
             and m.role in ('ketua_rt', 'bendahara'))
      or exists (
           select 1 from auth.mfa_factors f
           where f.user_id = (select auth.uid()) and f.status = 'verified');
$$;

create or replace function public.mfa_satisfied()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2' or not public.mfa_required();
$$;

-- ---------- Helper akses: ikut syarat verifikasi 2 langkah -------------
create or replace function public.has_rt_role(p_neighborhood_id uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_memberships m
    join public.profiles p on p.id = m.user_id
    where m.neighborhood_id = p_neighborhood_id
      and m.user_id = (select auth.uid())
      and m.is_active and p.is_active
      and m.role = any(p_roles)
  ) and (select public.mfa_satisfied());
$$;

create or replace function public.is_rt_member(p_neighborhood_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_memberships m
    join public.profiles p on p.id = m.user_id
    where m.neighborhood_id = p_neighborhood_id
      and m.user_id = (select auth.uid()) and m.is_active and p.is_active
  ) and (select public.mfa_satisfied());
$$;

create or replace function public.my_household_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select r.household_id from public.residents r
   where r.user_id = (select auth.uid()) and (select public.mfa_satisfied())
  union
  select r.household_id from public.user_memberships m
    join public.residents r on r.id = m.resident_id
   where m.user_id = (select auth.uid()) and m.is_active and (select public.mfa_satisfied());
$$;

-- ---------- Gerbang di setiap tabel ber-RLS -----------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and rowsecurity loop
    execute format('drop policy if exists "mfa gate" on public.%I', t);
    execute format(
      'create policy "mfa gate" on public.%I as restrictive for all to authenticated '
      'using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))', t);
  end loop;
end $$;

-- ---------- Status verifikasi 2 langkah anggota (untuk Ketua RT) --------
create or replace function public.member_mfa_status(p_neighborhood_id uuid)
returns table (user_id uuid, enrolled boolean)
language sql stable security definer set search_path = '' as $$
  select m.user_id,
         exists (select 1 from auth.mfa_factors f where f.user_id = m.user_id and f.status = 'verified')
  from public.user_memberships m
  where m.neighborhood_id = p_neighborhood_id
    and public.has_rt_role(p_neighborhood_id, array['ketua_rt']::public.app_role[]);
$$;

revoke all on function public.mfa_required() from public, anon;
revoke all on function public.mfa_satisfied() from public, anon;
revoke all on function public.member_mfa_status(uuid) from public, anon;
grant execute on function public.mfa_required() to authenticated;
grant execute on function public.mfa_satisfied() to authenticated;
grant execute on function public.member_mfa_status(uuid) to authenticated;
