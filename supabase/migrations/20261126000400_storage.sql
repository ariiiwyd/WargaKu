-- =====================================================================
-- WargaKu · Migration 0004 · Storage buckets (PRD §7.4)
-- Path file: <neighborhood_id>/<uuid>.<ext>. Jangan pernah memakai NIK,
-- nomor KK, atau nomor rekening di nama file. Bucket privat dibaca
-- memakai signed URL berumur pendek (mis. 60 detik) dari client.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',            'avatars',            false, 2097152,  array['image/jpeg','image/png','image/webp']),
  ('payment-proofs',     'payment-proofs',     false, 5242880,  array['image/jpeg','image/png','image/webp','application/pdf']),
  ('resident-documents', 'resident-documents', false, 5242880,  array['image/jpeg','image/png','application/pdf']),
  ('letters',            'letters',            false, 5242880,  array['application/pdf']),
  ('complaint-files',    'complaint-files',    false, 5242880,  array['image/jpeg','image/png','image/webp']),
  ('announcements',      'announcements',      false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('activity-media',     'activity-media',     false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Folder pertama = neighborhood_id
create or replace function public.storage_rt(p_name text)
returns uuid language sql immutable set search_path = '' as $$
  select nullif(split_part(p_name, '/', 1), '')::uuid;
$$;

-- Avatar & media kegiatan & lampiran pengumuman: anggota RT boleh baca
create policy "members read shared media" on storage.objects for select to authenticated
  using (bucket_id in ('avatars','activity-media','announcements') and public.is_rt_member(public.storage_rt(name)));
create policy "members upload avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and owner = (select auth.uid()) and public.is_rt_member(public.storage_rt(name)));
create policy "organizers upload activity media" on storage.objects for insert to authenticated
  with check (bucket_id = 'activity-media'
              and public.has_rt_role(public.storage_rt(name), array['ketua_rt','sekretaris','pengurus']::public.app_role[]));
create policy "editors upload announcement files" on storage.objects for insert to authenticated
  with check (bucket_id = 'announcements'
              and public.has_rt_role(public.storage_rt(name), array['ketua_rt','sekretaris','pengurus']::public.app_role[]));

-- Bukti transfer: pengunggah + Bendahara/Ketua
create policy "read payment proofs" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs'
         and (owner = (select auth.uid())
              or public.has_rt_role(public.storage_rt(name), array['ketua_rt','bendahara']::public.app_role[])));
create policy "upload payment proof" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and owner = (select auth.uid()) and public.is_rt_member(public.storage_rt(name)));

-- Dokumen identitas: hanya Ketua/Sekretaris (Bendahara TIDAK otomatis punya akses)
create policy "read resident documents" on storage.objects for select to authenticated
  using (bucket_id = 'resident-documents'
         and public.has_rt_role(public.storage_rt(name), array['ketua_rt','sekretaris']::public.app_role[]));
create policy "upload resident documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'resident-documents'
              and (owner = (select auth.uid())
                   or public.has_rt_role(public.storage_rt(name), array['ketua_rt','sekretaris']::public.app_role[])));

-- Surat jadi: pengelola + pemohon (dicek dari letter_requests.document_path)
create policy "read letters" on storage.objects for select to authenticated
  using (bucket_id = 'letters'
         and (public.has_rt_role(public.storage_rt(name), array['ketua_rt','sekretaris']::public.app_role[])
              or exists (select 1 from public.letter_requests lr
                         where lr.document_path = storage.objects.name
                           and lr.resident_id in (select public.my_resident_ids()))));
create policy "adm upload letters" on storage.objects for insert to authenticated
  with check (bucket_id = 'letters'
              and public.has_rt_role(public.storage_rt(name), array['ketua_rt','sekretaris']::public.app_role[]));

-- Foto pengaduan
create policy "read complaint files" on storage.objects for select to authenticated
  using (bucket_id = 'complaint-files'
         and (owner = (select auth.uid())
              or public.has_rt_role(public.storage_rt(name), array['ketua_rt','sekretaris','pengurus']::public.app_role[])));
create policy "upload complaint files" on storage.objects for insert to authenticated
  with check (bucket_id = 'complaint-files' and owner = (select auth.uid()) and public.is_rt_member(public.storage_rt(name)));
