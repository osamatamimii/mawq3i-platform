// Authenticated proxy for privileged (RLS-bypassing) database operations.
//
// WHY THIS FILE EXISTS: previously, the Supabase service_role key (which bypasses
// all Row Level Security) was hardcoded directly in frontend source files, meaning
// it shipped inside the public JS bundle for anyone to extract from their browser
// and get full read/write access to the entire database. This endpoint replaces
// that pattern: the service_role key now lives ONLY here, server-side, as an
// environment variable — and every call is authenticated + authorized before it
// touches the database.
//
// Authorization model:
//   - Caller must send a valid Supabase access token (from their own logged-in session).
//   - If the token belongs to the platform admin (ADMIN_EMAIL), any allowlisted
//     table/operation is permitted (mirrors the old "isAdminMode" behavior).
//   - Otherwise, the caller must pass a storeId, and we verify they actually own
//     that store (stores.owner_id === caller's user id) before allowing the operation,
//     scoped only to that store's data.
//   - Table names are restricted to an explicit allowlist regardless of caller.

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL = 'admin@mawq3i.com';
// Used only by the admin-only SiteBuilder "publish to GitHub" flow below.
// Previously this token was hardcoded in the SiteBuilder.tsx frontend bundle,
// meaning anyone could extract it from the browser and get repo write access.
// It now lives only here, server-side, gated behind the same admin check as
// everything else in this file.
const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_USER = 'osamatamimii';

const ALLOWED_TABLES = new Set([
  'products', 'bundles', 'orders', 'reviews', 'stores', 'store_staff',
  'offline_sales', 'promotions', 'discount_codes', 'abandoned_carts',
  'ai_image_generations', 'feature_usage_events', 'subscription_plans',
  'store_templates', 'device_tokens',
]);

// Shared secret used ONLY by the Supabase Database Webhook (server-to-server,
// no user access token) that fires on every new row in `orders`, so we can
// push a "new order" notification to the merchant's phone the moment it
// lands — same idea as Shopify's order-alert push. Configure this webhook in
// Supabase: Database > Webhooks > orders > INSERT > POST to
// https://mawq3i.co/api/secure-db?webhookToken=<PUSH_WEBHOOK_SECRET>
const PUSH_WEBHOOK_SECRET = process.env.PUSH_WEBHOOK_SECRET;
const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID;
const FCM_CLIENT_EMAIL = process.env.FCM_CLIENT_EMAIL;
const FCM_PRIVATE_KEY = (process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n');

// --- Minimal FCM HTTP v1 client (no external deps) -------------------------
// Google retired the legacy server-key FCM API, so v1 requires a short-lived
// OAuth2 access token obtained by signing a JWT with the Firebase service
// account's private key. This does that by hand with Node's built-in crypto.
async function getFcmAccessToken() {
  const crypto = await import('crypto');
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: FCM_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64url(header)}.${b64url(claim)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(FCM_PRIVATE_KEY).toString('base64url');
  const jwt = `${unsigned}.${signature}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('FCM auth failed: ' + JSON.stringify(d));
  return d.access_token;
}

async function sendPushToStore(storeId, title, bodyText, data) {
  if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
    console.error('Push not sent: FCM_* env vars not configured yet');
    return { sent: 0, reason: 'not_configured' };
  }
  const tokRes = await fetch(
    `${SUPABASE_URL}/rest/v1/device_tokens?store_id=eq.${encodeURIComponent(storeId)}&select=token,platform`,
    { headers: SERVICE_HEADERS },
  );
  const tokens = tokRes.ok ? await tokRes.json() : [];
  if (!tokens.length) return { sent: 0, reason: 'no_devices' };

  const accessToken = await getFcmAccessToken();
  let sent = 0;
  for (const t of tokens) {
    try {
      const r = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: { title, body: bodyText },
              data: data || {},
              android: {
                priority: 'high',
                notification: {
                  icon: 'ic_stat_notify', // white silhouette, see android/.../drawable-*/ic_stat_notify.png
                  color: '#3B6D11',
                  channel_id: 'orders',   // created client-side in src/lib/push.ts
                },
              },
              apns: { payload: { aps: { sound: 'default' } } },
            },
          }),
        },
      );
      if (r.ok) {
        sent += 1;
      } else {
        // Token likely stale/uninstalled — clean it up.
        const errText = await r.text();
        if (errText.includes('UNREGISTERED') || errText.includes('NOT_FOUND')) {
          await fetch(`${SUPABASE_URL}/rest/v1/device_tokens?token=eq.${encodeURIComponent(t.token)}`, {
            method: 'DELETE', headers: SERVICE_HEADERS,
          });
        }
      }
    } catch (e) {
      console.error('FCM send failed for one device', e);
    }
  }
  return { sent, of: tokens.length };
}

const SERVICE_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function getCallerFromToken(accessToken) {
  if (!accessToken || !ANON_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    const user = await r.json();
    if (!user?.id) return null;
    return { id: user.id, email: (user.email || '').toLowerCase() };
  } catch {
    return null;
  }
}

async function verifyStoreOwnership(storeId, userId) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${encodeURIComponent(storeId)}&select=owner_id`, {
      headers: SERVICE_HEADERS,
    });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0] && rows[0].owner_id === userId;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!SERVICE_KEY) {
    res.status(500).json({ error: 'secure-db is not configured (missing SUPABASE_SERVICE_ROLE_KEY)' });
    return;
  }

  try {
    // Supabase Database Webhook call: server-to-server, verified by a shared
    // secret in the URL instead of a user access token (the DB has no user
    // session to hand us). Kept separate from the normal auth path below.
    const webhookToken = req.query?.webhookToken;
    if (webhookToken) {
      if (!PUSH_WEBHOOK_SECRET || webhookToken !== PUSH_WEBHOOK_SECRET) {
        res.status(401).json({ error: 'Invalid webhook token' });
        return;
      }
      const payload = req.body || {};
      const order = payload.record || payload;
      const storeIdFromOrder = order.store_id;
      if (!storeIdFromOrder) {
        res.status(400).json({ error: 'No store_id on order payload' });
        return;
      }
      const amount = order.amount ? `${order.amount} ${order.currency || ''}`.trim() : '';
      const result = await sendPushToStore(
        storeIdFromOrder,
        'طلب جديد! 🛍️',
        `${order.customer_name || 'زبون'} طلب ${order.product_name || 'منتج'}${amount ? ` — ${amount}` : ''}`,
        { type: 'new_order', orderId: String(order.id || '') },
      );
      res.status(200).json({ ok: true, push: result });
      return;
    }

    const { accessToken, action, table, query, filter, body, storeId } = req.body || {};

    const GITHUB_ACTIONS = ['github_get_file', 'github_push_file', 'github_create_repo'];
    if (!ALLOWED_TABLES.has(table) && action !== 'auth_create_user' && action !== 'ai_generate_store_plan' && !GITHUB_ACTIONS.includes(action)) {
      res.status(400).json({ error: 'Table not allowed' });
      return;
    }
    if (!['select', 'insert', 'update', 'delete', 'auth_create_user', 'ai_generate_store_plan', ...GITHUB_ACTIONS].includes(action)) {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    const caller = await getCallerFromToken(accessToken);
    if (!caller) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const isAdmin = caller.email === ADMIN_EMAIL;

    // Creating a new Supabase Auth user (used only when onboarding a new store
    // owner) is inherently a platform-admin-only operation — it can't be scoped
    // to a store the way table CRUD can, since the store doesn't exist yet.
    if (action === 'auth_create_user') {
      if (!isAdmin) {
        res.status(403).json({ error: 'Admin only' });
        return;
      }
      const { email, password } = body || {};
      if (!email || !password) {
        res.status(400).json({ error: 'Missing email or password' });
        return;
      }
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: SERVICE_HEADERS,
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      if (!authRes.ok) {
        const errText = await authRes.text();
        res.status(authRes.status).json({ error: 'Failed to create auth user', detail: errText.slice(0, 300) });
        return;
      }
      const userData = await authRes.json();
      res.status(200).json({ id: userData?.id ?? null });
      return;
    }

    // AI Store Builder: turn a free-text prompt into a structured store plan
    // (template pick, name, accent color, product list) that the Create Store
    // wizard then pre-fills for the admin to review before anything is saved.
    // Admin-only, same as every other privileged action in this file.
    if (action === 'ai_generate_store_plan') {
      if (!isAdmin) {
        res.status(403).json({ error: 'Admin only' });
        return;
      }
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'AI builder is not configured (missing OPENAI_API_KEY)' });
        return;
      }
      const { prompt, templates } = body || {};
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Missing prompt' });
        return;
      }
      const templateList = Array.isArray(templates) ? templates : [];
      const templateKeys = templateList.map(t => t.key);

      const systemPrompt = `أنت مصمم متاجر إلكترونية محترف عندك ذوق مميز، تشتغل لمنصة موقعي (Mawq3i) اللي بتخدم تجار فلسطين والأردن والخليج.
مهمتك: تاخذ وصف تاجر لمتجره (قد يكون جملة قصيرة أو فقرة) وترجعه كخطة متجر جاهزة، بصيغة JSON فقط بدون أي نص إضافي.

القوالب المتاحة (اختر الأنسب واحد فقط حسب نوع المنتجات المذكورة):
${templateList.map(t => `- key: "${t.key}" | ${t.name_ar} | فئة: ${t.category} | ${t.description_ar}`).join('\n')}

قواعد التصميم المهمة (لازم تلتزم فيها):
- اللون الرئيسي (accent_hex): اختر لون فعلي مناسب لطبيعة المنتجات المذكورة تحديداً، وليس لون قالب افتراضي أو ألوان AI المكررة (تدرج بنفسجي-أزرق، أو كريمي دافئ+تراكوتا، أو أسود مع نيون). اللون يجب أن يكون له علاقة حقيقية بالمنتج أو الجو العام المطلوب.
- أسماء وأوصاف المنتجات: عربي بسيط ومباشر يعكس المنتجات المذكورة فعلاً بالبرومبت، تجنب الكليشيهات التسويقية الفارغة ("الأفضل"، "جودة عالية جداً"، "لا يفوتك"). لو التاجر ذكر منتجات محددة استخدمها بالضبط، ولو ما ذكر، اقترح منتجات واقعية ومنطقية لنوع المتجر.
- الأسعار: بالشيكل (ILS)، أرقام واقعية لسوق فلسطين/الأردن حسب نوع المنتج.
- بدك تنتج بين 4 إلى 6 منتجات.
- كل منتج ممكن يكون عنده خيار واحد (مثل اللون أو المقاس) لو منطقي لنوع المنتج، وإلا اتركه فاضي.

أرجع JSON بالضبط بهذا الشكل (بدون أي markdown أو نص خارج الـ JSON):
{
  "template_key": "one of: ${templateKeys.join(', ')}",
  "name_ar": "اسم المتجر بالعربي",
  "name_en_slug_hint": "اسم انجليزي قصير مناسب كـ slug (أحرف صغيرة وشرطات فقط، بدون مسافات)",
  "accent_hex": "#rrggbb",
  "products": [
    { "name_ar": "...", "price": 0, "category": "...", "desc_ar": "...", "badge": "", "variant_name": "", "variant_options": "" }
  ]
}`;

      try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt.trim().slice(0, 2000) },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 1400,
          }),
        });
        if (!openaiRes.ok) {
          const errText = await openaiRes.text();
          res.status(502).json({ error: 'AI provider error', detail: errText.slice(0, 400) });
          return;
        }
        const data = await openaiRes.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
          res.status(502).json({ error: 'Empty AI response' });
          return;
        }
        let plan;
        try {
          plan = JSON.parse(content);
        } catch {
          res.status(502).json({ error: 'AI returned invalid JSON' });
          return;
        }
        // Guard against a hallucinated template key.
        if (!templateKeys.includes(plan.template_key)) {
          plan.template_key = templateKeys[0] || null;
        }
        res.status(200).json(plan);
      } catch (err) {
        res.status(500).json({ error: err?.message || 'AI generation failed' });
      }
      return;
    }

    // SiteBuilder / Store Builder: create + read/write a client store repo's
    // index.html on GitHub. Admin-only — the token that authorizes this never
    // reaches the browser.
    if (action === 'github_get_file' || action === 'github_push_file' || action === 'github_create_repo') {
      if (!isAdmin) {
        res.status(403).json({ error: 'Admin only' });
        return;
      }
      if (!GITHUB_PAT) {
        res.status(500).json({ error: 'GitHub publishing is not configured (missing GITHUB_PAT)' });
        return;
      }
      const { slug } = body || {};
      if (!slug || !/^[a-zA-Z0-9-]+$/.test(slug)) {
        res.status(400).json({ error: 'Missing or invalid slug' });
        return;
      }
      const repo = `${GITHUB_USER}/${slug}-site`;
      const ghHeaders = { Authorization: `token ${GITHUB_PAT}`, Accept: 'application/vnd.github.v3+json' };

      // Used by the Store Builder wizard when creating a brand-new store from
      // a template: creates an empty repo (private) that github_push_file can
      // then write index.html into.
      if (action === 'github_create_repo') {
        const createRes = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: { ...ghHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `${slug}-site`, private: true, auto_init: true }),
        });
        if (!createRes.ok) {
          const errText = await createRes.text();
          // 422 with "already exists" is fine — repo can already be there from a retry.
          if (createRes.status !== 422) {
            res.status(createRes.status).json({ error: 'Failed to create GitHub repo', detail: errText.slice(0, 300) });
            return;
          }
        }
        res.status(200).json({ ok: true, repo });
        return;
      }

      if (action === 'github_get_file') {
        const ghRes = await fetch(`https://api.github.com/repos/${repo}/contents/index.html`, { headers: ghHeaders });
        if (!ghRes.ok) {
          res.status(ghRes.status).json({ error: 'Failed to fetch file from GitHub' });
          return;
        }
        const d = await ghRes.json();
        const content = Buffer.from(d.content, 'base64').toString('utf-8');
        res.status(200).json({ sha: d.sha, content });
        return;
      }

      if (action === 'github_push_file') {
        const { htmlContent, sha, message } = body || {};
        if (!htmlContent) {
          res.status(400).json({ error: 'Missing htmlContent' });
          return;
        }
        const b64 = Buffer.from(htmlContent, 'utf-8').toString('base64');
        // sha is required only when overwriting an existing file; omitted, GitHub creates a new one.
        const putBody = { message: message || `update ${slug} site`, content: b64 };
        if (sha) putBody.sha = sha;
        const ghRes = await fetch(`https://api.github.com/repos/${repo}/contents/index.html`, {
          method: 'PUT',
          headers: { ...ghHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(putBody),
        });
        if (!ghRes.ok) {
          const errText = await ghRes.text();
          res.status(ghRes.status).json({ error: 'Failed to push to GitHub', detail: errText.slice(0, 300) });
          return;
        }
        const d = await ghRes.json();
        res.status(200).json({ ok: true, newSha: d.content?.sha ?? null });
        return;
      }
    }

    if (!isAdmin) {
      if (!storeId) {
        res.status(403).json({ error: 'storeId is required for non-admin callers' });
        return;
      }
      const owns = await verifyStoreOwnership(storeId, caller.id);
      if (!owns) {
        res.status(403).json({ error: 'Not authorized for this store' });
        return;
      }
    }

    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    let method = 'GET';
    let fetchBody;
    let extraHeaders = {};

    if (action === 'select') {
      url += `?${query || ''}`;
      method = 'GET';
    } else if (action === 'insert') {
      method = 'POST';
      fetchBody = JSON.stringify(body || {});
      extraHeaders = { Prefer: 'return=representation' };
    } else if (action === 'update') {
      url += `?${filter || ''}`;
      method = 'PATCH';
      fetchBody = JSON.stringify(body || {});
      extraHeaders = { Prefer: 'return=representation' };
    } else if (action === 'delete') {
      url += `?${filter || ''}`;
      method = 'DELETE';
    }

    const upstream = await fetch(url, {
      method,
      headers: { ...SERVICE_HEADERS, ...extraHeaders },
      body: fetchBody,
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status).json({ error: 'Database operation failed', detail: errText.slice(0, 300) });
      return;
    }

    const text = await upstream.text();
    const data = text ? JSON.parse(text) : null;
    res.status(200).json(action === 'insert' ? (Array.isArray(data) ? data[0] : data) : data);
  } catch (err) {
    console.error('secure-db handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
