import crypto from 'crypto';

// ============================================================
// Growth Agent — مزامنة يومية لجدول product_daily_stats
// يجمع views (من GA4) + purchases/revenue (من orders + offline_sales)
// لكل منتج/متجر/يوم، ويحفظها بجدول product_daily_stats.
//
// يُستدعى تلقائياً عبر Vercel Cron (انظر vercel.json)، أو يدوياً:
//   GET /api/growth-agent-sync?date=2026-07-16
// (لو ما انبعث ?date، بيستخدم "أمس" بتوقيت UTC)
// ============================================================

const GA_PROPERTY_STOREFRONTS = '545020889'; // نفس الـ property المستخدم بـ analytics-data.js

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`Supabase GET ${path} failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbUpsert(table, rows, onConflict) {
  if (!rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`Supabase upsert ${table} failed: ${r.status} ${await r.text()}`);
}

// ---------- GA4 (نفس نمط المصادقة الموجود بـ analytics-data.js) ----------

let cachedToken = null;

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getGA4AccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) return cachedToken.accessToken;
  const raw = process.env.GA_SERVICE_ACCOUNT_KEY;
  if (!raw) return null; // GA غير مفعّل — نكمل بدون views
  const key = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(key.private_key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!res.ok) throw new Error(`GA4 token exchange failed: ${await res.text()}`);
  const data = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

// يرجّع { productId: views } لمتجر معيّن، ليوم واحد محدد (startDate=endDate=date)
async function getProductViewsForDate(hostname, date) {
  const accessToken = await getGA4AccessToken();
  if (!accessToken || !hostname) return {};

  const body = {
    dateRanges: [{ startDate: date, endDate: date }],
    metrics: [{ name: 'screenPageViews' }],
    dimensions: [{ name: 'pagePath' }, { name: 'hostName' }],
    dimensionFilter: {
      filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: hostname } },
    },
    limit: 5000,
  };

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY_STOREFRONTS}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`GA4 runReport failed for ${hostname}:`, res.status, await res.text());
    return {};
  }
  const report = await res.json();
  const rows = report.rows || [];
  const views = {};
  rows.forEach((row) => {
    const pagePath = row.dimensionValues?.[0]?.value || '';
    const count = Number(row.metricValues?.[0]?.value || 0);
    const m = pagePath.match(/[?&]id=([a-f0-9-]{8,})/i);
    if (m) {
      const pid = m[1];
      views[pid] = (views[pid] || 0) + count;
    }
  });
  return views;
}

// ---------- تجميع المبيعات (orders + offline_sales) ----------

function isValidUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function getSalesForDate(storeId, validProductIds, date) {
  const purchases = {}; // productId -> qty
  const revenue = {};   // productId -> revenue
  let unmatchedItems = 0;

  // orders (السلة أونلاين): items jsonb array [{ product_id, qty, price, ... }]
  const orders = await sbGet(
    `orders?store_id=eq.${storeId}&date=eq.${date}&status=neq.cancelled&select=items`
  );
  for (const order of orders) {
    for (const item of order.items || []) {
      const pid = item.product_id;
      const qty = Number(item.qty || item.quantity || 1);
      const price = Number(item.price || 0);
      if (isValidUuid(pid) && validProductIds.has(pid)) {
        purchases[pid] = (purchases[pid] || 0) + qty;
        revenue[pid] = (revenue[pid] || 0) + qty * price;
      } else {
        // منتج بمعرّف قديم (slug) مش UUID — بيانات تاريخية موروثة، نتجاهله بأمان
        unmatchedItems++;
      }
    }
  }

  // offline_sales (بيع من المحل): product_id هون FK حقيقي uuid دايماً
  const nextDate = new Date(`${date}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextDateStr = nextDate.toISOString().slice(0, 10);
  const offline = await sbGet(
    `offline_sales?store_id=eq.${storeId}&created_at=gte.${date}T00:00:00Z&created_at=lt.${nextDateStr}T00:00:00Z&select=product_id,quantity,sale_price`
  );
  for (const sale of offline) {
    const pid = sale.product_id;
    if (!pid) continue;
    const qty = Number(sale.quantity || 1);
    purchases[pid] = (purchases[pid] || 0) + qty;
    revenue[pid] = (revenue[pid] || 0) + qty * Number(sale.sale_price || 0);
  }

  return { purchases, revenue, unmatchedItems };
}

// ---------- الدالة الأساسية (تُستدعى مباشرة من orchestrator أو من الـ handler) ----------

export async function runSync(dateOverride) {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var');

  let date = dateOverride;
  if (!date) {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    date = yesterday.toISOString().slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format, expected YYYY-MM-DD');
  }

  const summary = { date, storesProcessed: 0, rowsUpserted: 0, unmatchedOrderItems: 0, errors: [] };

  const stores = await sbGet('stores?status=eq.active&select=id,domain,slug');

  for (const store of stores) {
    try {
      const products = await sbGet(`products?store_id=eq.${store.id}&select=id`);
      const validProductIds = new Set(products.map((p) => p.id));
      if (validProductIds.size === 0) continue;

      const hostname = store.domain || (store.slug ? `${store.slug}.mawq3i.co` : null);

      const [views, sales] = await Promise.all([
        getProductViewsForDate(hostname, date),
        getSalesForDate(store.id, validProductIds, date),
      ]);

      summary.unmatchedOrderItems += sales.unmatchedItems;

      const productIdsSeen = new Set([
        ...Object.keys(views),
        ...Object.keys(sales.purchases),
        ...Object.keys(sales.revenue),
      ]);

      const rows = [];
      for (const pid of productIdsSeen) {
        if (!validProductIds.has(pid)) continue; // views ممكن تجيب IDs من متاجر/مصادر ثانية بالغلط — تحقق دايماً
        rows.push({
          store_id: store.id,
          product_id: pid,
          stat_date: date,
          views: views[pid] || 0,
          add_to_cart: 0, // غير مُتتبّع حالياً — يحتاج GA4 event إضافي لاحقاً
          purchases: sales.purchases[pid] || 0,
          revenue: sales.revenue[pid] || 0,
          updated_at: new Date().toISOString(),
        });
      }

      await sbUpsert('product_daily_stats', rows, 'store_id,product_id,stat_date');
      summary.rowsUpserted += rows.length;
      summary.storesProcessed++;
    } catch (storeErr) {
      summary.errors.push({ store_id: store.id, message: storeErr?.message });
      console.error(`growth-agent-sync failed for store ${store.id}:`, storeErr);
    }
  }

  return summary;
}

// ---------- المعالج (للاستدعاء اليدوي عبر HTTP فقط — الـ Cron الفعلي يستدعي runSync مباشرة من growth-agent-cron.js) ----------

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const q = req.method === 'GET' ? req.query : (req.body || {});
  try {
    const summary = await runSync(q.date);
    res.status(200).json(summary);
  } catch (err) {
    console.error('growth-agent-sync handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
