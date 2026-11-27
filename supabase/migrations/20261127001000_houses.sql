-- =====================================================================
-- WargaKu · Migration 0010 · Rumah terpisah dari Keluarga (KK)
-- Satu rumah bisa dihuni beberapa KK. Tabel `households` kini berarti
-- Keluarga/KK dan menginduk ke `houses`. Kolom households.house_number &
-- address dipertahankan sebagai salinan otomatis dari rumahnya, agar
-- surat, notifikasi, dan tampilan lama tetap benar.
-- Privasi tetap per KK: warga hanya melihat KK-nya sendiri.
-- Iuran per jenis: ditagih per rumah (ke KK penanggung jawab) atau per KK.
-- =====================================================================

-- ---------- Tabel rumah ----------------------------------------------
create table public.houses (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id),
  house_number varchar(30) not null,
  address text not null,
  status text not null default 'occupied' check (status in ('occupied', 'vacant', 'inactive')),
  billing_household_id uuid,
  created_at timestamptz not null default now(),
  unique (neighborhood_id, house_number),
  unique (neighborhood_id, id)
);
create index idx_houses_neighborhood on public.houses(neighborhood_id);

-- ---------- Backfill: setiap keluarga lama menjadi 1 rumah + 1 KK -----
alter table public.households add column house_id uuid;

insert into public.houses (id, neighborhood_id, house_number, address, status, billing_household_id, created_at)
select gen_random_uuid(), h.neighborhood_id, h.house_number, h.address,
       case h.status when 'vacant' then 'vacant' when 'inactive' then 'inactive' else 'occupied' end,
       h.id, h.created_at
from public.households h;

update public.households h set house_id = o.id
from public.houses o
where o.neighborhood_id = h.neighborhood_id and o.house_number = h.house_number;

-- Rumah kosong lama tidak punya KK penanggung jawab nyata bila tidak ada anggota.
update public.houses o set billing_household_id = null
where not exists (select 1 from public.residents r where r.household_id = o.billing_household_id and r.is_active);
update public.households h set status = 'active' where h.status = 'vacant';

alter table public.households alter column house_id set not null;
alter table public.households
  add constraint households_house_fk foreign key (neighborhood_id, house_id) references public.houses(neighborhood_id, id);
alter table public.households drop constraint if exists households_neighborhood_id_house_number_key;
alter table public.households drop constraint if exists households_status_check;
alter table public.households add constraint households_status_check check (status in ('active', 'inactive'));
create index idx_households_house on public.households(house_id);

alter table public.houses
  add constraint houses_billing_fk foreign key (neighborhood_id, billing_household_id)
  references public.households(neighborhood_id, id) deferrable initially deferred;

-- ---------- Salinan nomor/alamat rumah ke KK -------------------------
create or replace function public.sync_household_from_house()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.houses;
begin
  select * into v from public.houses where id = new.house_id;
  if not found or v.neighborhood_id <> new.neighborhood_id then raise exception 'Rumah tidak ditemukan di RT ini'; end if;
  new.house_number := v.house_number;
  new.address := v.address;
  return new;
end $$;
create trigger trg_household_sync_house before insert or update of house_id, house_number, address on public.households
  for each row execute function public.sync_household_from_house();

create or replace function public.sync_house_to_households()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.house_number is distinct from old.house_number or new.address is distinct from old.address then
    update public.households set house_number = new.house_number, address = new.address where house_id = new.id;
  end if;
  return new;
end $$;
create trigger trg_house_sync_households after update of house_number, address on public.houses
  for each row execute function public.sync_house_to_households();

-- KK pertama di rumah otomatis menjadi penanggung jawab iuran rumah; rumah jadi berpenghuni.
-- Bila KK penanggung jawab pindah rumah atau dinonaktifkan, tugas itu pindah ke KK aktif lain
-- di rumah lamanya; rumah tanpa KK aktif menjadi kosong.
create or replace function public.on_household_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.house_id is distinct from old.house_id
                           or (new.status = 'inactive' and old.status = 'active')) then
    update public.houses o
       set billing_household_id = (select h.id from public.households h
                                    where h.house_id = o.id and h.status = 'active' and h.id <> new.id
                                    order by h.created_at limit 1)
     where o.id = old.house_id and o.billing_household_id = new.id;
    update public.houses o set status = 'vacant'
     where o.id = old.house_id and o.status = 'occupied'
       and not exists (select 1 from public.households h where h.house_id = o.id and h.status = 'active');
  end if;
  if new.status = 'active' and (tg_op = 'INSERT' or new.house_id is distinct from old.house_id or old.status <> 'active') then
    update public.houses
       set billing_household_id = coalesce(billing_household_id, new.id),
           status = case when status = 'vacant' then 'occupied' else status end
     where id = new.house_id;
  end if;
  return new;
end $$;
create trigger trg_household_changed after insert or update of house_id, status on public.households
  for each row execute function public.on_household_changed();

-- Penanggung jawab harus KK di rumah itu sendiri.
create or replace function public.validate_house_billing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.billing_household_id is not null and not exists (
    select 1 from public.households h where h.id = new.billing_household_id and h.house_id = new.id) then
    raise exception 'Penanggung jawab iuran harus KK yang tinggal di rumah ini';
  end if;
  return new;
end $$;
create trigger trg_validate_house_billing before insert or update of billing_household_id on public.houses
  for each row execute function public.validate_house_billing();

-- Audit perubahan rumah
create trigger audit_houses after insert or update or delete on public.houses
  for each row execute function public.audit_row_change();

-- ---------- RLS rumah -------------------------------------------------
alter table public.houses enable row level security;
grant select, insert, update, delete on public.houses to authenticated;

create policy "staff read houses" on public.houses for select to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris','bendahara','pengurus']::public.app_role[]));
create policy "warga reads own house" on public.houses for select to authenticated
  using (id in (select h.house_id from public.households h where h.id in (select public.my_household_ids())));
create policy "adm insert houses" on public.houses for insert to authenticated
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
create policy "adm update houses" on public.houses for update to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]))
  with check (public.has_rt_role(neighborhood_id, array['ketua_rt','sekretaris']::public.app_role[]));
create policy "ketua deletes empty houses" on public.houses for delete to authenticated
  using (public.has_rt_role(neighborhood_id, array['ketua_rt']::public.app_role[])
         and not exists (select 1 from public.households h where h.house_id = houses.id));

-- View KK tanpa No. KK untuk Bendahara/Pengurus: tambahkan house_id.
create or replace view public.households_safe with (security_invoker = false) as
  select h.id, h.neighborhood_id, h.house_number, h.address, h.head_resident_id, h.status, h.created_at, h.house_id
  from public.households h
  where public.has_rt_role(h.neighborhood_id, array['ketua_rt','sekretaris','bendahara','pengurus']::public.app_role[])
     or h.id in (select public.my_household_ids());

-- ---------- Iuran per rumah atau per KK -------------------------------
alter table public.dues_types add column billing_unit text not null default 'rumah'
  check (billing_unit in ('rumah', 'kk'));
-- Iuran sosial/santunan lazimnya per KK; bisa diubah Bendahara di menu Jenis Iuran.
update public.dues_types set billing_unit = 'kk' where name ilike 'iuran sosial%';

alter table public.dues_invoices add column house_id uuid;
alter table public.dues_invoices
  add constraint invoices_house_fk foreign key (neighborhood_id, house_id) references public.houses(neighborhood_id, id);
update public.dues_invoices i set house_id = h.house_id
from public.households h, public.dues_types t
where h.id = i.household_id and t.id = i.dues_type_id and t.billing_unit = 'rumah';
-- Satu tagihan per rumah per periode untuk iuran per rumah (walau penanggung jawab berganti).
create unique index uq_invoice_house_period
  on public.dues_invoices(neighborhood_id, house_id, dues_type_id, period_year, coalesce(period_month, 0))
  where house_id is not null and status <> 'cancelled';
create index idx_invoices_house on public.dues_invoices(house_id);

-- create_invoice: iuran per rumah wajib ditujukan ke KK penanggung jawab rumahnya.
create or replace function public.create_invoice(p_household_id uuid, p_dues_type_id uuid,
  p_period_year int, p_period_month int default null, p_amount numeric default null, p_due_date date default null)
returns public.dues_invoices language plpgsql security definer set search_path = '' as $$
declare
  v_type public.dues_types;
  v_hh public.households;
  v_house public.houses;
  v_no int;
  v_inv public.dues_invoices;
begin
  select * into v_hh from public.households where id = p_household_id;
  if not found then raise exception 'Keluarga tidak ditemukan'; end if;
  if not public.has_rt_role(v_hh.neighborhood_id, array['ketua_rt','bendahara']::public.app_role[]) then
    raise exception 'Tidak berwenang membuat tagihan' using errcode = '42501';
  end if;
  if v_hh.status <> 'active' then raise exception 'KK ini sudah tidak aktif'; end if;
  select * into v_type from public.dues_types where id = p_dues_type_id and neighborhood_id = v_hh.neighborhood_id and is_active;
  if not found then raise exception 'Jenis iuran tidak aktif atau berbeda RT'; end if;
  if v_type.billing_period = 'bulanan' and p_period_month is null then
    raise exception 'Iuran bulanan wajib mencantumkan bulan';
  end if;
  select * into v_house from public.houses where id = v_hh.house_id;
  if v_type.billing_unit = 'rumah' and v_house.billing_household_id is distinct from v_hh.id then
    raise exception 'Iuran per rumah ditagihkan ke KK penanggung jawab rumah %', v_house.house_number;
  end if;

  v_no := public.next_document_number(v_hh.neighborhood_id, 'invoice', p_period_year::text);
  insert into public.dues_invoices (neighborhood_id, household_id, house_id, dues_type_id, invoice_number,
    period_month, period_year, amount, due_date, created_by)
  values (v_hh.neighborhood_id, v_hh.id, case when v_type.billing_unit = 'rumah' then v_house.id end, v_type.id,
    format('INV/%s/%s', p_period_year, lpad(v_no::text, 5, '0')),
    case when v_type.billing_period = 'bulanan' then p_period_month end,
    p_period_year, coalesce(p_amount, v_type.amount), p_due_date, (select auth.uid()))
  returning * into v_inv;

  perform public.write_audit(v_inv.neighborhood_id, 'create_invoice', 'dues_invoices', v_inv.id, null, to_jsonb(v_inv));
  perform public.notify_household(v_hh.id, 'Tagihan baru',
    format('%s · Rp%s', v_type.name, to_char(v_inv.amount, 'FM999G999G999')), 'invoice', v_inv.id);
  return v_inv;
end $$;

-- Fungsi trigger baru tidak boleh dipanggil lewat API (lihat migration 0008).
do $$
declare f text;
begin
  foreach f in array array[
    'public.sync_household_from_house()',
    'public.sync_house_to_households()',
    'public.on_household_changed()',
    'public.validate_house_billing()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
