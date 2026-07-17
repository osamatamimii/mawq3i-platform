// ============================================================
// Growth Agent — المرحلة 2: بدء ربط حساب Meta Ads
// يستدعى من لوحة صاحب المتجر (Settings) بـ POST + Authorization: Bearer <supabase access token>
// ============================================================

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5Nzc4NjksImV4cCI6MjA5MzU1Mzg2OX0.N7iVS_0tBPqfpHAFPw9OxpA2n7JXRWZEbzp3R0ZiNHI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getUserFromToken(accessToken) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI; // مثال: https://mawq3i.co/api/meta-oauth-callback
  if (!appId || !redirectUri) {
    res.status(200).json({ configured: false, message: 'Meta App not configured yet — يحتاج META_APP_ID و META_OAUTH_REDIRECT_URI بالـ env vars.' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { store_id: storeId } = req.body || {};
  if (!token || !storeId) { res.status(400).json({ error: 'Missing token or store_id' }); return; }

  const user = await getUserFromToken(token);
  if (!user?.id) { res.status(401).json({ error: 'Invalid session' }); return; }

  // تحقق إنه المتجر فعلاً تبع هاد المستخدم
  const storeCheck = await fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${storeId}&owner_id=eq.${user.id}&select=id`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  const stores = await storeCheck.json();
  if (!Array.isArray(stores) || stores.length === 0) {
    res.status(403).json({ error: 'Store does not belong to this user' });
    return;
  }

  // إنشاء intent مؤقت (15 دقيقة) — الـ state بالرابط رح يكون معرّفه
  const intentRes = await fetch(`${SUPABASE_URL}/rest/v1/oauth_connect_intents`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ store_id: storeId, platform: 'meta', created_by: user.id }),
  });
  const [intent] = await intentRes.json();
  if (!intent?.id) { res.status(500).json({ error: 'Failed to create connect intent' }); return; }

  const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', intent.id);
  authUrl.searchParams.set('scope', 'ads_read,business_management');

  res.status(200).json({ configured: true, authUrl: authUrl.toString() });
}
