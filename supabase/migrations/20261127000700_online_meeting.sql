-- =====================================================================
-- WargaKu · Migration 0007 · Rapat online (tautan Google Meet / Zoom)
-- Kegiatan bisa tatap muka, online, atau hybrid. Warga yang tidak bisa
-- datang bergabung lewat tautan; kehadirannya tercatat "present_online".
-- Pengurus membagikan notulen & tautan rekaman setelah rapat.
-- =====================================================================

alter type public.attendance_status add value if not exists 'present_online';

alter table public.activities
  add column if not exists meeting_mode text not null default 'offline',
  add column if not exists meeting_url text,
  add column if not exists recording_url text,
  add column if not exists minutes text,
  add column if not exists minutes_published_at timestamptz,
  add column if not exists minutes_by uuid references public.profiles(id);

alter table public.activities
  add constraint activities_meeting_mode_check check (meeting_mode in ('offline', 'online', 'hybrid')),
  add constraint activities_meeting_url_https check (meeting_url is null or meeting_url ~ '^https://'),
  add constraint activities_recording_url_https check (recording_url is null or recording_url ~ '^https://'),
  add constraint activities_meeting_url_required check (meeting_mode = 'offline' or meeting_url is not null);

-- Jendela gabung: 15 menit sebelum mulai s.d. 30 menit setelah selesai
-- (bila tanpa jam selesai: 3 jam setelah mulai), atau selama status "ongoing".
create or replace function public.meeting_is_live(p_activity public.activities)
returns boolean language sql stable set search_path = '' as $$
  select p_activity.meeting_mode <> 'offline'
     and p_activity.status <> 'cancelled'
     and (p_activity.status = 'ongoing'
          or (p_activity.status = 'planned'
              and now() between p_activity.start_at - interval '15 minutes'
                            and coalesce(p_activity.end_at, p_activity.start_at + interval '3 hours') + interval '30 minutes'));
$$;

-- Gabung rapat online: catat kehadiran "present_online" lalu kembalikan tautan.
create or replace function public.join_online_meeting(p_activity_id uuid, p_resident_id uuid default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v public.activities;
  v_res uuid;
begin
  select * into v from public.activities where id = p_activity_id;
  if not found then raise exception 'Kegiatan tidak ditemukan'; end if;
  if not public.is_rt_member(v.neighborhood_id) then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  if v.meeting_mode = 'offline' then raise exception 'Kegiatan ini tidak memiliki rapat online'; end if;
  if not public.meeting_is_live(v) then
    raise exception 'Rapat online belum dibuka. Tombol gabung aktif 15 menit sebelum rapat dimulai.';
  end if;

  if p_resident_id is null then
    select r.id into v_res from public.residents r where r.user_id = (select auth.uid()) limit 1;
    if v_res is null then
      select m.resident_id into v_res from public.user_memberships m
       where m.user_id = (select auth.uid()) and m.neighborhood_id = v.neighborhood_id and m.is_active;
    end if;
  else
    if not (p_resident_id in (select public.my_resident_ids())
            or public.has_rt_role(v.neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[])) then
      raise exception 'Hanya untuk anggota keluarga sendiri' using errcode = '42501';
    end if;
    v_res := p_resident_id;
  end if;

  -- Akun pengurus tanpa data warga tetap boleh membuka tautan; hanya absensinya yang dilewati.
  if v_res is not null then
    insert into public.activity_participants (neighborhood_id, activity_id, resident_id, attendance_status)
    values (v.neighborhood_id, v.id, v_res, 'present_online')
    on conflict (activity_id, resident_id) do update
      set attendance_status = case
        when public.activity_participants.attendance_status = 'present' then public.activity_participants.attendance_status
        else 'present_online'::public.attendance_status end;
  end if;
  return v.meeting_url;
end $$;

-- Bagikan notulen & tautan rekaman ke seluruh warga.
create or replace function public.publish_meeting_minutes(p_activity_id uuid, p_minutes text, p_recording_url text default null)
returns public.activities language plpgsql security definer set search_path = '' as $$
declare v public.activities; v_first boolean;
begin
  select * into v from public.activities where id = p_activity_id for update;
  if not found then raise exception 'Kegiatan tidak ditemukan'; end if;
  if not public.has_rt_role(v.neighborhood_id, array['ketua_rt','sekretaris','pengurus']::public.app_role[]) then
    raise exception 'Hanya pengurus yang dapat membagikan notulen' using errcode = '42501';
  end if;
  if coalesce(trim(p_minutes), '') = '' then raise exception 'Notulen wajib diisi'; end if;
  if nullif(trim(p_recording_url), '') is not null and trim(p_recording_url) !~ '^https://' then
    raise exception 'Tautan rekaman harus diawali https://';
  end if;
  v_first := v.minutes_published_at is null;
  update public.activities
     set minutes = trim(p_minutes),
         recording_url = nullif(trim(p_recording_url), ''),
         minutes_published_at = now(),
         minutes_by = (select auth.uid())
   where id = v.id returning * into v;
  perform public.notify_roles(v.neighborhood_id, array['ketua_rt','sekretaris','bendahara','pengurus','warga']::public.app_role[],
    case when v_first then 'Notulen rapat tersedia' else 'Notulen rapat diperbarui' end,
    v.title, 'activity', v.id, (select auth.uid()));
  perform public.write_audit(v.neighborhood_id, 'publish_minutes', 'activities', v.id, null,
    jsonb_build_object('title', v.title, 'recording', v.recording_url is not null));
  return v;
end $$;

-- Notifikasi saat rapat online/hybrid dimulai.
create or replace function public.on_meeting_started()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'ongoing' and old.status is distinct from 'ongoing' and new.meeting_mode <> 'offline' then
    perform public.notify_roles(new.neighborhood_id, array['ketua_rt','sekretaris','bendahara','pengurus','warga']::public.app_role[],
      'Rapat dimulai — gabung online', new.title, 'activity', new.id, (select auth.uid()));
  end if;
  return new;
end $$;
drop trigger if exists trg_meeting_started on public.activities;
create trigger trg_meeting_started after update of status on public.activities
  for each row execute function public.on_meeting_started();

do $$
declare f text;
begin
  foreach f in array array[
    'public.join_online_meeting(uuid, uuid)',
    'public.publish_meeting_minutes(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function public.meeting_is_live(public.activities) from public, anon;
grant execute on function public.meeting_is_live(public.activities) to authenticated;
