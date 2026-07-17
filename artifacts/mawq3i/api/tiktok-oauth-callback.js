// ============================================================
// Growth Agent — المرحلة 2: استلام رد TikTok OAuth وحفظ الحساب
// TikTok بترجّع هون بـ ?auth_code=...&state=<intent_id>
// ============================================================

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders(extra = {}) {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

function redirectWithMessage(res, ok, message) {
  const url = `/dashboard/settings?tiktok_connect=${ok ? 'success' : 'error'}&msg=${encodeURIComponent(message)}`;
  res.writeHead(302, { Location: url });
  res.end();
}

export default async function handler(req, res) {
  const appId = process.env.TIKTOK_APP_ID;
  const appSecret = process.env.TIKTOK_APP_SECRET;
  if (!appId || !appSecret) { redirectWithMessage(res, false, 'TikTok App غير مفعّل بعد على السيرفر'); return; }

  const { auth_code: authCode, state } = req.query;
  if (!authCode || !state) { redirectWithMessage(res, false, 'رد ناقص من TikTok'); return; }

  try {
    const intentRes = await fetch(`${SUPABASE_URL}/rest/v1/oauth_connect_intents?id=eq.${state}&used=eq.false&select=*`, { headers: sbHeaders() });
    const [intent] = await intentRes.json();
    if (!intent || new Date(intent.expires_at) < new Date()) {
      redirectWithMessage(res, false, 'انتهت صلاحية طلب الربط، حاول من جديد');
      return;
    }

    const tokenRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, secret: appSecret, auth_code: authCode }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.data?.access_token;
    const advertiserIds = tokenData?.data?.advertiser_ids || [];
    if (!accessToken || !advertiserIds.length) {
      redirectWithMessage(res, false, 'ما لقينا حساب إعلانات مربوط بحسابك على TikTok');
      return;
    }

    const firstAdvertiserId = advertiserIds[0];
    // جلب اسم الحساب الإعلاني
    let advertiserName = firstAdvertiserId;
    try {
      const infoRes = await fetch(
        `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify([firstAdvertiserId]))}`,
        { headers: { 'Access-Token': accessToken } }
      );
      const infoData = await infoRes.json();
      advertiserName = infoData?.data?.list?.[0]?.name || firstAdvertiserId;
    } catch { /* اسم افتراضي كافي لو فشل */ }

    await fetch(`${SUPABASE_URL}/rest/v1/ad_accounts?on_conflict=store_id,platform,external_account_id`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([{
        store_id: intent.store_id,
        platform: 'tiktok',
        external_account_id: firstAdvertiserId,
        external_account_name: advertiserName,
        access_token: accessToken,
        token_expires_at: null, // توكنات TikTok Business ما إلها انتهاء صلاحية قصير عادةً؛ نراقبها بمعالجة الأخطاء بالمزامنة
        status: 'connected',
        connected_by: intent.created_by,
      }]),
    });

    await fetch(`${SUPABASE_URL}/rest/v1/oauth_connect_intents?id=eq.${intent.id}`, {
      method: 'PATCH',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ used: true }),
    });

    redirectWithMessage(res, true, `تم ربط حساب ${advertiserName}`);
  } catch (err) {
    console.error('tiktok-oauth-callback error:', err);
    redirectWithMessage(res, false, 'صار خطأ غير متوقع أثناء الربط');
  }
}
