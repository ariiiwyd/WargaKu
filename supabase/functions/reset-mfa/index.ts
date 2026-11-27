// Supabase Edge Function: reset-mfa
// Ketua RT menghapus verifikasi 2 langkah anggota RT-nya yang kehilangan HP,
// supaya anggota itu bisa memasang authenticator baru saat masuk berikutnya.
// Syarat: pemanggil Ketua RT aktif di RT yang sama DAN sesinya sudah aal2.
// service_role HANYA dipakai di sini (server), tidak pernah dikirim ke browser.
//
// Deploy:  supabase functions deploy reset-mfa
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Klaim JWT (token sudah divalidasi oleh auth.getUser sebelum ini dipakai). */
function claims(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')));
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Metode tidak diizinkan' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: who } = await caller.auth.getUser();
  if (!who.user) return json({ error: 'Sesi tidak valid' }, 401);
  if (claims(authHeader.replace(/^Bearer\s+/i, '')).aal !== 'aal2') {
    return json({ error: 'Masukkan kode verifikasi 2 langkah Anda terlebih dahulu' }, 403);
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Format permintaan tidak valid' }, 400);
  }
  if (!body.userId) return json({ error: 'Pilih pengguna' }, 400);
  if (body.userId === who.user.id) return json({ error: 'Kelola verifikasi 2 langkah Anda sendiri di menu Pengaturan' }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: target } = await admin.from('user_memberships').select('neighborhood_id').eq('user_id', body.userId).maybeSingle();
  if (!target) return json({ error: 'Pengguna tidak ditemukan' }, 404);
  const { data: me } = await admin.from('user_memberships').select('role, is_active')
    .eq('user_id', who.user.id).eq('neighborhood_id', target.neighborhood_id).maybeSingle();
  if (!me || !me.is_active || me.role !== 'ketua_rt') return json({ error: 'Hanya Ketua RT yang dapat mereset verifikasi 2 langkah' }, 403);

  const { data: list, error: lErr } = await admin.auth.admin.mfa.listFactors({ userId: body.userId });
  if (lErr) return json({ error: lErr.message }, 400);
  let removed = 0;
  for (const f of list?.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: body.userId });
    if (error) return json({ error: error.message }, 400);
    removed++;
  }

  await admin.from('audit_logs').insert({
    neighborhood_id: target.neighborhood_id, user_id: who.user.id, action: 'reset_mfa', table_name: 'user_memberships',
    record_id: body.userId, new_data: { removed_factors: removed },
  });
  return json({ removed });
});
