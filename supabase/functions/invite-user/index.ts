// Supabase Edge Function: invite-user
// Membuat/mengundang akun warga dan menautkannya ke data warga + role.
// Hanya Ketua RT aktif yang boleh memanggil. service_role HANYA dipakai di sini
// (server), tidak pernah dikirim ke browser.
//
// Deploy:  supabase functions deploy invite-user
// Secret:  SITE_URL (mis. https://wargaku.vercel.app) — dipakai untuk tautan undangan.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Metode tidak diizinkan' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const site = Deno.env.get('SITE_URL') ?? new URL(req.headers.get('origin') ?? url).origin;

  // 1. Identitas pemanggil dari JWT-nya sendiri
  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: who } = await caller.auth.getUser();
  if (!who.user) return json({ error: 'Sesi tidak valid' }, 401);

  let body: { residentId?: string; email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Format permintaan tidak valid' }, 400);
  }
  const email = (body.email ?? '').trim().toLowerCase();
  const role = body.role ?? 'warga';
  if (!body.residentId) return json({ error: 'Pilih warga' }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Format email tidak valid' }, 400);
  if (!['sekretaris', 'bendahara', 'pengurus', 'warga'].includes(role)) return json({ error: 'Role tidak valid' }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });

  // 2. Data warga + pastikan pemanggil Ketua RT di RT yang sama
  const { data: resident, error: rErr } = await admin.from('residents').select('id, neighborhood_id, full_name, phone, user_id').eq('id', body.residentId).single();
  if (rErr || !resident) return json({ error: 'Warga tidak ditemukan' }, 404);
  if (resident.user_id) return json({ error: 'Warga ini sudah memiliki akun' }, 409);

  const { data: me } = await admin.from('user_memberships').select('role, is_active').eq('user_id', who.user.id).eq('neighborhood_id', resident.neighborhood_id).maybeSingle();
  if (!me || !me.is_active || me.role !== 'ketua_rt') return json({ error: 'Hanya Ketua RT yang dapat membuat akun' }, 403);

  // 3. Undang via email (profil dibuat otomatis oleh trigger handle_new_user)
  const { data: invited, error: iErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: resident.full_name, phone: resident.phone },
    redirectTo: `${site}/atur-sandi`,
  });
  if (iErr || !invited.user) return json({ error: iErr?.message ?? 'Gagal mengirim undangan' }, 400);
  const uid = invited.user.id;

  await admin.from('profiles').upsert({ id: uid, full_name: resident.full_name, email, phone: resident.phone }, { onConflict: 'id' });
  const { error: mErr } = await admin.from('user_memberships').insert({ neighborhood_id: resident.neighborhood_id, user_id: uid, role, resident_id: resident.id });
  if (mErr) return json({ error: mErr.message }, 400);
  await admin.from('residents').update({ user_id: uid }).eq('id', resident.id);
  await admin.from('audit_logs').insert({
    neighborhood_id: resident.neighborhood_id, user_id: who.user.id, action: 'invite_user', table_name: 'user_memberships',
    record_id: uid, new_data: { role, resident: resident.full_name },
  });

  return json({ userId: uid });
});
