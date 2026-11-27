-- =====================================================================
-- WargaKu · Migration 0009 · Kelola regu & jadwal ronda
-- Ketua RT / Pengurus membuat regu (hari jaga, ketua regu, anggota) dan
-- jadwal ronda dibuat otomatis dari hari jaga. Jadwal yang sudah memiliki
-- laporan tidak pernah diubah atau dihapus.
-- =====================================================================

-- Buat jadwal untuk semua regu aktif dari p_from selama p_weeks minggu.
-- Mengembalikan jumlah jadwal baru (tanggal yang sudah ada dilewati).
create or replace function public.generate_patrol_schedules(p_neighborhood_id uuid, p_from date default null, p_weeks int default 4)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_from date := coalesce(p_from, (now() at time zone 'Asia/Jakarta')::date);
  v_count int;
begin
  if not public.has_rt_role(p_neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]) then
    raise exception 'Hanya Ketua RT atau Pengurus yang dapat membuat jadwal ronda' using errcode = '42501';
  end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 12 then raise exception 'Jumlah minggu harus 1 sampai 12'; end if;

  insert into public.patrol_schedules (neighborhood_id, team_id, patrol_date)
  select p_neighborhood_id, t.id, d::date
  from public.patrol_teams t
  cross join generate_series(v_from, v_from + (p_weeks * 7 - 1), interval '1 day') as d
  where t.neighborhood_id = p_neighborhood_id
    and t.is_active
    and extract(dow from d)::smallint = any(t.weekdays)
  on conflict (neighborhood_id, team_id, patrol_date) do nothing;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform public.write_audit(p_neighborhood_id, 'generate_patrol_schedules', 'patrol_schedules', null, null,
      jsonb_build_object('from', v_from, 'weeks', p_weeks, 'created', v_count));
  end if;
  return v_count;
end $$;

-- Simpan regu (baru atau ubah) beserta anggotanya dalam satu transaksi,
-- lalu sesuaikan jadwal ke depan yang belum dilaporkan.
create or replace function public.save_patrol_team(
  p_neighborhood_id uuid, p_team_id uuid, p_name text, p_weekdays smallint[], p_leader uuid, p_members uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_team_id;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_members uuid[] := array(select distinct unnest(coalesce(p_members, '{}'::uuid[])));
begin
  if not public.has_rt_role(p_neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]) then
    raise exception 'Hanya Ketua RT atau Pengurus yang dapat mengelola regu ronda' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nama regu wajib diisi'; end if;
  if p_weekdays is null or cardinality(p_weekdays) = 0 then raise exception 'Pilih minimal satu hari jaga'; end if;
  if exists (select 1 from unnest(p_weekdays) w where w < 0 or w > 6) then raise exception 'Hari jaga tidak valid'; end if;
  if cardinality(v_members) = 0 then raise exception 'Pilih minimal satu anggota regu'; end if;
  if exists (select 1 from unnest(v_members) m
             where not exists (select 1 from public.residents r
                               where r.id = m and r.neighborhood_id = p_neighborhood_id and r.is_active)) then
    raise exception 'Ada anggota yang bukan warga aktif RT ini';
  end if;
  if p_leader is not null and not (p_leader = any(v_members)) then
    raise exception 'Ketua regu harus termasuk anggota regu';
  end if;

  if v_id is null then
    insert into public.patrol_teams (neighborhood_id, name, leader_resident_id, weekdays)
    values (p_neighborhood_id, trim(p_name), p_leader, p_weekdays)
    returning id into v_id;
  else
    update public.patrol_teams
       set name = trim(p_name), leader_resident_id = p_leader, weekdays = p_weekdays, is_active = true
     where id = v_id and neighborhood_id = p_neighborhood_id;
    if not found then raise exception 'Regu tidak ditemukan'; end if;
    -- Hari jaga berubah: hapus jadwal ke depan yang tidak lagi cocok dan belum dilaporkan.
    delete from public.patrol_schedules s
     where s.team_id = v_id and s.patrol_date >= v_today
       and not (extract(dow from s.patrol_date)::smallint = any(p_weekdays))
       and not exists (select 1 from public.patrol_reports pr where pr.schedule_id = s.id);
  end if;

  delete from public.patrol_members where team_id = v_id and not (resident_id = any(v_members));
  insert into public.patrol_members (neighborhood_id, team_id, resident_id)
  select p_neighborhood_id, v_id, m from unnest(v_members) m
  on conflict (team_id, resident_id) do nothing;

  perform public.write_audit(p_neighborhood_id, case when p_team_id is null then 'insert' else 'update' end, 'patrol_teams', v_id, null,
    jsonb_build_object('name', trim(p_name), 'weekdays', p_weekdays, 'members', cardinality(v_members)));
  return v_id;
end $$;

-- Nonaktifkan regu: histori laporan tetap, jadwal ke depan yang belum dilaporkan dihapus.
create or replace function public.deactivate_patrol_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.patrol_teams; v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into v from public.patrol_teams where id = p_team_id for update;
  if not found then raise exception 'Regu tidak ditemukan'; end if;
  if not public.has_rt_role(v.neighborhood_id, array['ketua_rt','pengurus']::public.app_role[]) then
    raise exception 'Hanya Ketua RT atau Pengurus yang dapat mengelola regu ronda' using errcode = '42501';
  end if;
  update public.patrol_teams set is_active = false where id = v.id;
  delete from public.patrol_schedules s
   where s.team_id = v.id and s.patrol_date >= v_today
     and not exists (select 1 from public.patrol_reports pr where pr.schedule_id = s.id);
  perform public.write_audit(v.neighborhood_id, 'deactivate', 'patrol_teams', v.id, null, jsonb_build_object('name', v.name));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.generate_patrol_schedules(uuid, date, int)',
    'public.save_patrol_team(uuid, uuid, text, smallint[], uuid, uuid[])',
    'public.deactivate_patrol_team(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
