// ============================================================
// Growth Agent — المرحلة 2: استلام رد Meta OAuth وحفظ الحساب
// Meta بترجّع المستخدم هون بـ ?code=...&state=<intent_id>
// ============================================================

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders(extra = {}) {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

function redirectWithMessage(res, ok, message) {
  const url = `/dashboard/settings?meta_connect=${ok ? 'success' : 'error'}&msg=${encodeURIComponent(message)}`;
  res.writeHead(302, { Location: url });
  res.end();
}

export default async function handler(req, res) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    redirectWithMessage(res, false, 'Meta App غير مفعّل بعد على السيرفر');
    return;
  }

  const { code, state, error: oauthError } = req.query;
  if (oauthError) { redirectWithMessage(res, false, 'رفض التاجر الربط أو صار خطأ بـ Meta'); return; }
  if (!code || !state) { redirectWithMessage(res, false, 'رد ناقص من Meta'); return; }

  try {
    // تحقق من الـ intent
    const intentRes = await fetch(`${SUPABASE_URL}/rest/v1/oauth_connect_intents?id=eq.${state}&used=eq.false&select=*`, { headers: sbHeaders() });
    const [intent] = await intentRes.json();
    if (!intent || new Date(intent.expires_at) < new Date()) {
      redirectWithMessage(res, false, 'انتهت صلاحية طلب الربط، حاول من جديد');
      return;
    }

    // بدّل الكود بـ access token
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);
    const tokenRes = await fetch(tokenUrl.toString());
    if (!tokenRes.ok) { redirectWithMessage(res, false, 'فشل تبديل الكود بتوكن'); return; }
    const tokenData = await tokenRes.json();
    const shortToken = tokenData.access_token;

    // تبديل لتوكن طويل الأمد (60 يوم تقريباً)
    const longTokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longTokenUrl.searchParams.set('client_id', appId);
    longTokenUrl.searchParams.set('client_secret', appSecret);
    longTokenUrl.searchParams.set('fb_exchange_token', shortToken);
    const longTokenRes = await fetch(longTokenUrl.toString());
    const longTokenData = longTokenRes.ok ? await longTokenRes.json() : null;
    const finalToken = longTokenData?.access_token || shortToken;
    const expiresInSec = longTokenData?.expires_in || tokenData.expires_in || 5184000;

    // اجلب أول حساب إعلانات تابع للمستخدم (MVP: أول حساب فقط)
    const adAccountsRes = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name&access_token=${finalToken}`);
    const adAccountsData = adAccountsRes.ok ? await adAccountsRes.json() : { data: [] };
    const firstAccount = adAccountsData?.data?.[0];
    if (!firstAccount) {
      redirectWithMessage(res, false, 'ما لقينا حساب إعلانات مربوط بحسابك على Meta');
      return;
    }

    await fetch(`${SUPABASE_URL}/rest/v1/ad_accounts?on_conflict=store_id,platform,external_account_id`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([{
        store_id: intent.store_id,
        platform: 'meta',
        external_account_id: firstAccount.account_id,
        external_account_name: firstAccount.name,
        access_token: finalToken,
        token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
        status: 'connected',
        connected_by: intent.created_by,
      }]),
    });

    // اقفل الـ intent
    await fetch(`${SUPABASE_URL}/rest/v1/oauth_connect_intents?id=eq.${intent.id}`, {
      method: 'PATCH',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ used: true }),
    });

    redirectWithMessage(res, true, `تم ربط حساب ${firstAccount.name}`);
  } catch (err) {
    console.error('meta-oauth-callback error:', err);
    redirectWithMessage(res, false, 'صار خطأ غير متوقع أثناء الربط');
  }
}
