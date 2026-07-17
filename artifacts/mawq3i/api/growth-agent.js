// ============================================================
// Growth Agent — ملف موحّد لكل وظائف وكيل النمو
//
// ⚠️ مقصود يكون بملف واحد: خطة Vercel "Hobby" فيها حد أقصى 12
// Serverless Function بكل نشر. عندنا أصلاً ~11 ملف API تاني بالمنصة،
// فمين ما تبقى إلا خانة وحدة لوكيل النمو بالكامل. لو احتجنا نضيف
// وظيفة API جديدة غير متعلقة بوكيل النمو مستقبلاً، إما نضيفها هون
// كـ action جديد، أو نرفع لخطة Pro (بيلغي هاد القيد تماماً).
//
// الاستخدام (؟action=):
//   GET  /api/growth-agent                        → Cron اليومي (orchestrator كامل)
//   GET  /api/growth-agent?action=sync             → مزامنة بيانات المتاجر (يدوي)
//   GET  /api/growth-agent?action=ads-sync         → مزامنة أداء الإعلانات (يدوي)
//   GET  /api/growth-agent?action=diagnose         → محرك التشخيص (يدوي)
//   GET  /api/growth-agent?action=capture-results  → قياس نتائج الإجراءات (يدوي)
//   GET  /api/growth-agent?action=monthly-plan     → التقييم الشهري (يدوي)
//   POST /api/growth-agent?action=execute-action   → موافقة/رفض إجراء (من صاحب المتجر)
//   POST /api/growth-agent?action=oauth-start&platform=meta|tiktok   → بدء ربط حساب إعلانات
//   GET  /api/growth-agent?action=oauth-callback&platform=meta|tiktok → رد Meta/TikTok (redirect_uri)
// ============================================================

import crypto from 'crypto';

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5Nzc4NjksImV4cCI6MjA5MzU1Mzg2OX0.N7iVS_0tBPqfpHAFPw9OxpA2n7JXRWZEbzp3R0ZiNHI';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WINDOW_DAYS = 14;
const MIN_PRODUCT_AGE_DAYS = 14;
const MIN_VIEWS_FOR_CONVERSION_CHECK = 30;
const MIN_STORE_VIEWS_FOR_BENCHMARK = 50;
const MIN_CART_SAMPLE = 5;
const DEDUP_WINDOW_DAYS = 7;
const ACTION_ESCALATION_DAYS = 21;
const TRUST_MIN_STORE_AGE_DAYS = 60;
const TRUST_MIN_APPROVED_ACTIONS = 3;
const LAUNCH_MAX_AGE_DAYS = 60;
const LAUNCH_MIN_ORDERS = 10;
const GA_PROPERTY_STOREFRONTS = '545020889';

// ---------- أدوات Supabase مشتركة ----------

function sbHeaders(extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...extra };
}
async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`Supabase GET ${path} failed: ${r.status} ${await r.text()}`);
  return r.json();
}
async function sbInsert(table, rows) {
  if (!rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(`Supabase insert ${table} failed: ${r.status} ${await r.text()}`);
}
async function sbUpsert(table, rows, onConflict) {
  if (!rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, { method: 'POST', headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(`Supabase upsert ${table} failed: ${r.status} ${await r.text()}`);
}
async function sbPatch(table, filter, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { method: 'PATCH', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Supabase patch ${table} failed: ${r.status} ${await r.text()}`);
}
async function getUserFromToken(accessToken) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return null;
  return r.json();
}
function isoDate(d) { return d.toISOString().slice(0, 10); }
function daysAgoISODate(n) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); }
function isValidUuid(v) { return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }
function pctChange(before, after) { if (before <= 0) return after > 0 ? 100 : 0; return ((after - before) / before) * 100; }

// ============================================================
// 1) SYNC — مزامنة يومية لـ product_daily_stats (GA4 + orders + offline_sales)
// ============================================================

let cachedGA4Token = null;
function base64url(input) { return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

async function getGA4AccessToken() {
  if (cachedGA4Token && cachedGA4Token.expiresAt > Date.now() + 30000) return cachedGA4Token.accessToken;
  const raw = process.env.GA_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  const key = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = { iss: key.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(key.private_key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `${unsigned}.${signature}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!res.ok) throw new Error(`GA4 token exchange failed: ${await res.text()}`);
  const data = await res.json();
  cachedGA4Token = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedGA4Token.accessToken;
}

async function getProductViewsForDate(hostname, date) {
  const accessToken = await getGA4AccessToken();
  if (!accessToken || !hostname) return {};
  const body = {
    dateRanges: [{ startDate: date, endDate: date }],
    metrics: [{ name: 'screenPageViews' }],
    dimensions: [{ name: 'pagePath' }, { name: 'hostName' }],
    dimensionFilter: { filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: hostname } } },
    limit: 5000,
  };
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY_STOREFRONTS}:runReport`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`GA4 runReport failed for ${hostname}:`, res.status, await res.text()); return {}; }
  const report = await res.json();
  const views = {};
  for (const row of report.rows || []) {
    const pagePath = row.dimensionValues?.[0]?.value || '';
    const count = Number(row.metricValues?.[0]?.value || 0);
    const m = pagePath.match(/[?&]id=([a-f0-9-]{8,})/i);
    if (m) views[m[1]] = (views[m[1]] || 0) + count;
  }
  return views;
}

async function getSalesForDate(storeId, validProductIds, date) {
  const purchases = {}, revenue = {};
  let unmatchedItems = 0;
  const orders = await sbGet(`orders?store_id=eq.${storeId}&date=eq.${date}&status=neq.cancelled&select=items`);
  for (const order of orders) {
    for (const item of order.items || []) {
      const pid = item.product_id, qty = Number(item.qty || item.quantity || 1), price = Number(item.price || 0);
      if (isValidUuid(pid) && validProductIds.has(pid)) {
        purchases[pid] = (purchases[pid] || 0) + qty;
        revenue[pid] = (revenue[pid] || 0) + qty * price;
      } else unmatchedItems++;
    }
  }
  const nextDate = new Date(`${date}T00:00:00Z`); nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const offline = await sbGet(`offline_sales?store_id=eq.${storeId}&created_at=gte.${date}T00:00:00Z&created_at=lt.${nextDate.toISOString().slice(0, 10)}T00:00:00Z&select=product_id,quantity,sale_price`);
  for (const sale of offline) {
    const pid = sale.product_id; if (!pid) continue;
    const qty = Number(sale.quantity || 1);
    purchases[pid] = (purchases[pid] || 0) + qty;
    revenue[pid] = (revenue[pid] || 0) + qty * Number(sale.sale_price || 0);
  }
  return { purchases, revenue, unmatchedItems };
}

async function runSync(dateOverride) {
  let date = dateOverride || daysAgoISODate(1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date format, expected YYYY-MM-DD');
  const summary = { date, storesProcessed: 0, rowsUpserted: 0, unmatchedOrderItems: 0, errors: [] };
  const stores = await sbGet('stores?status=eq.active&select=id,domain,slug');

  for (const store of stores) {
    try {
      const products = await sbGet(`products?store_id=eq.${store.id}&select=id`);
      const validProductIds = new Set(products.map((p) => p.id));
      if (validProductIds.size === 0) continue;
      const hostname = store.domain || (store.slug ? `${store.slug}.mawq3i.co` : null);
      const [views, sales] = await Promise.all([getProductViewsForDate(hostname, date), getSalesForDate(store.id, validProductIds, date)]);
      summary.unmatchedOrderItems += sales.unmatchedItems;
      const productIdsSeen = new Set([...Object.keys(views), ...Object.keys(sales.purchases), ...Object.keys(sales.revenue)]);
      const rows = [];
      for (const pid of productIdsSeen) {
        if (!validProductIds.has(pid)) continue;
        rows.push({ store_id: store.id, product_id: pid, stat_date: date, views: views[pid] || 0, add_to_cart: 0, purchases: sales.purchases[pid] || 0, revenue: sales.revenue[pid] || 0, updated_at: new Date().toISOString() });
      }
      await sbUpsert('product_daily_stats', rows, 'store_id,product_id,stat_date');
      summary.rowsUpserted += rows.length;
      summary.storesProcessed++;
    } catch (storeErr) {
      summary.errors.push({ store_id: store.id, message: storeErr?.message });
      console.error(`sync failed for store ${store.id}:`, storeErr);
    }
  }
  return summary;
}

// ============================================================
// 2) ADS-SYNC — مزامنة أداء الحملات الإعلانية (Meta + TikTok)
// ============================================================

async function syncMetaAccount(account, date) {
  const url = new URL(`https://graph.facebook.com/v19.0/act_${account.external_account_id}/insights`);
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc');
  url.searchParams.set('time_range', JSON.stringify({ since: date, until: date }));
  url.searchParams.set('access_token', account.access_token);
  const r = await fetch(url.toString());
  if (!r.ok) {
    const errText = await r.text();
    if (r.status === 401 || errText.includes('OAuthException')) await sbPatch('ad_accounts', `id=eq.${account.id}`, { status: 'expired' });
    throw new Error(`Meta insights failed for account ${account.external_account_id}: ${r.status} ${errText}`);
  }
  const data = await r.json();
  return (data.data || []).map((row) => ({ store_id: account.store_id, platform: 'meta', campaign_id: row.campaign_id, campaign_name: row.campaign_name, stat_date: date, spend: Number(row.spend || 0), impressions: Number(row.impressions || 0), clicks: Number(row.clicks || 0), ctr: row.ctr != null ? Number(row.ctr) : null, cpc: row.cpc != null ? Number(row.cpc) : null }));
}

async function syncTikTokAccount(account, date) {
  const r = await fetch('https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/', {
    method: 'POST', headers: { 'Access-Token': account.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ advertiser_id: account.external_account_id, report_type: 'BASIC', data_level: 'AUCTION_CAMPAIGN', dimensions: ['campaign_id', 'stat_time_day'], metrics: ['campaign_name', 'spend', 'impressions', 'clicks', 'ctr', 'cpc'], start_date: date, end_date: date, page_size: 100 }),
  });
  if (!r.ok) throw new Error(`TikTok report failed for account ${account.external_account_id}: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return (data?.data?.list || []).map((row) => ({ store_id: account.store_id, platform: 'tiktok', campaign_id: row.dimensions?.campaign_id, campaign_name: row.metrics?.campaign_name, stat_date: date, spend: Number(row.metrics?.spend || 0), impressions: Number(row.metrics?.impressions || 0), clicks: Number(row.metrics?.clicks || 0), ctr: row.metrics?.ctr != null ? Number(row.metrics.ctr) : null, cpc: row.metrics?.cpc != null ? Number(row.metrics.cpc) : null }));
}

async function runAdsSync(dateOverride) {
  const date = dateOverride || daysAgoISODate(1);
  const summary = { date, accountsProcessed: 0, rowsUpserted: 0, errors: [] };
  const accounts = await sbGet('ad_accounts?status=eq.connected&select=id,store_id,platform,external_account_id,access_token');
  if (!accounts.length) return { ...summary, message: 'ما في حسابات إعلانات مربوطة بعد' };
  for (const account of accounts) {
    try {
      const rows = account.platform === 'meta' ? await syncMetaAccount(account, date) : await syncTikTokAccount(account, date);
      const validRows = rows.filter((r) => r.campaign_id);
      await sbUpsert('ad_campaigns_daily', validRows, 'store_id,platform,campaign_id,stat_date');
      summary.rowsUpserted += validRows.length;
      summary.accountsProcessed++;
    } catch (accErr) {
      summary.errors.push({ account_id: account.id, platform: account.platform, message: accErr?.message });
      console.error(`ads-sync failed for account ${account.id}:`, accErr);
    }
  }
  return summary;
}

// ============================================================
// 3) DIAGNOSE — محرك التشخيص القائم على القواعد + قرارات محدودة تلقائية
// ============================================================

async function alreadyDiagnosedRecently(storeId, diagnosisKey, relatedProductId) {
  const since = new Date(Date.now() - DEDUP_WINDOW_DAYS * 86400000).toISOString();
  let path = `store_growth_events?store_id=eq.${storeId}&created_at=gte.${since}&data->>diagnosis_key=eq.${diagnosisKey}&select=id`;
  path += relatedProductId ? `&related_product_id=eq.${relatedProductId}` : `&related_product_id=is.null`;
  return (await sbGet(path)).length > 0;
}

async function isStoreTrusted(store) {
  if (!store.join_date) return false;
  const ageDays = (Date.now() - new Date(store.join_date).getTime()) / 86400000;
  if (ageDays < TRUST_MIN_STORE_AGE_DAYS) return false;
  const approved = await sbGet(`store_growth_events?store_id=eq.${store.id}&event_type=eq.suggested_action&status=eq.approved&select=id&limit=${TRUST_MIN_APPROVED_ACTIONS}`);
  return approved.length >= TRUST_MIN_APPROVED_ACTIONS;
}

async function hideProduct(productId) {
  await sbPatch('products', `id=eq.${productId}`, { status: 'hidden' });
}

// ============================================================
// 3.5) VARIANT SUGGEST — يقترح نسخة بديلة فعلية (وصف منتج) لاختبارها، مش بس "حسّن الوصف"
// ============================================================

const OPENAI_MODEL = 'gpt-4.1-nano';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function generateVariantDescription(productName, currentDesc) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const systemPrompt = `أنت خبير نمو لمتجر إلكتروني عربي. مهمتك تكتب نسخة بديلة من وصف منتج (2-4 جمل) بيعية أقوى من الأصلي — تبرز الفائدة للزبون، تخلق ثقة، وتشجع على الشراء. لا تخترع مواصفات غير مذكورة أصلاً بالوصف الحالي. رد بالوصف الجديد فقط، بدون أي مقدمة أو علامات اقتباس.`;
    const userContent = `اسم المنتج: ${productName}\nالوصف الحالي: ${currentDesc || '(فارغ)'}`;
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }], temperature: 0.7, max_tokens: 300 }),
    });
    if (!res.ok) { console.error('variant generation failed:', res.status, await res.text()); return null; }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('generateVariantDescription error:', e?.message);
    return null;
  }
}


async function diagnoseStore(store, sinceDate, bench) {
  const events = [];
  const [stats, products] = await Promise.all([
    sbGet(`product_daily_stats?store_id=eq.${store.id}&stat_date=gte.${sinceDate}&select=product_id,views,purchases,revenue`),
    sbGet(`products?store_id=eq.${store.id}&select=id,name_ar,name_en,desc_ar,status,created_at`),
  ]);
  if (!stats.length) return events;

  const productMap = {}; for (const p of products) productMap[p.id] = p;
  const perProduct = {};
  for (const s of stats) {
    const pid = s.product_id;
    if (!perProduct[pid]) perProduct[pid] = { views: 0, purchases: 0, revenue: 0 };
    perProduct[pid].views += s.views || 0;
    perProduct[pid].purchases += s.purchases || 0;
    perProduct[pid].revenue += s.revenue || 0;
  }
  const productName = (p) => p?.name_ar || p?.name_en || 'منتج';

  const storeTrusted = await isStoreTrusted(store);
  for (const [pid, agg] of Object.entries(perProduct)) {
    const product = productMap[pid];
    if (!product || product.status !== 'visible') continue;
    const productAgeDays = (Date.now() - new Date(product.created_at).getTime()) / 86400000;
    if (productAgeDays < MIN_PRODUCT_AGE_DAYS) continue;
    if (agg.purchases !== 0) continue;

    if (productAgeDays >= ACTION_ESCALATION_DAYS) {
      const key = 'suggest_hide_product';
      if (await alreadyDiagnosedRecently(store.id, key, pid)) continue;
      const baseEvent = { store_id: store.id, category: 'product', related_product_id: pid, title: `اقتراح إخفاء: ${productName(product)}`, description: `صفر مبيعات خلال آخر ${WINDOW_DAYS} يوم، والمنتج راكد بشكل مستمر (${Math.floor(productAgeDays)} يوم بدون بيعة). اقتراح: إخفاء المنتج مؤقتاً (قابل للتراجع بأي وقت من صفحة المنتجات).`, data: { diagnosis_key: key, action_type: 'hide_product', views: agg.views, purchases: agg.purchases, product_age_days: Math.floor(productAgeDays) } };
      if (storeTrusted) {
        try {
          await hideProduct(pid);
          events.push({ ...baseEvent, event_type: 'auto_action', requires_approval: false, status: 'auto_executed', resolved_at: new Date().toISOString() });
        } catch (e) { console.error(`auto-hide failed for product ${pid}:`, e?.message); }
      } else {
        events.push({ ...baseEvent, event_type: 'suggested_action', requires_approval: true });
      }
    } else {
      const key = 'stagnant_product';
      if (await alreadyDiagnosedRecently(store.id, key, pid)) continue;
      events.push({ store_id: store.id, event_type: 'diagnosis', category: 'product', related_product_id: pid, requires_approval: false, title: `منتج راكد: ${productName(product)}`, description: `صفر مبيعات خلال آخر ${WINDOW_DAYS} يوم رغم ${agg.views} مشاهدة. لو استمر الوضع، رح نقترح إخفاءه بعد أسبوع.`, data: { diagnosis_key: key, views: agg.views, purchases: agg.purchases, window_days: WINDOW_DAYS } });
    }
  }

  const totalViews = Object.values(perProduct).reduce((s, a) => s + a.views, 0);
  const totalPurchases = Object.values(perProduct).reduce((s, a) => s + a.purchases, 0);
  const storeConversionPct = totalViews > 0 ? (totalPurchases / totalViews) * 100 : 0;

  if (storeConversionPct > 0) {
    for (const [pid, agg] of Object.entries(perProduct)) {
      const product = productMap[pid];
      if (!product || product.status !== 'visible') continue;
      if (agg.views < MIN_VIEWS_FOR_CONVERSION_CHECK) continue;
      const productConversionPct = (agg.purchases / agg.views) * 100;
      if (productConversionPct < storeConversionPct * 0.5) {
        const key = 'low_conversion_product';
        if (await alreadyDiagnosedRecently(store.id, key, pid)) continue;

        const variantText = await generateVariantDescription(productName(product), product.desc_ar);
        if (variantText && variantText !== product.desc_ar) {
          events.push({
            store_id: store.id, event_type: 'suggested_action', category: 'product', related_product_id: pid, requires_approval: true,
            title: `اقترحت نسخة بديلة لوصف: ${productName(product)}`,
            description: `${agg.views} مشاهدة بس ${agg.purchases} مبيعة فقط (تحويل ${productConversionPct.toFixed(1)}% مقابل متوسط المتجر ${storeConversionPct.toFixed(1)}%). جرّبت أكتبلك وصف بديل أقوى بيعياً — شوف البريفيو وقرر.`,
            data: { diagnosis_key: key, action_type: 'apply_product_variant', views: agg.views, purchases: agg.purchases, product_cvr: productConversionPct, store_cvr: storeConversionPct, variant: { field: 'desc_ar', original: product.desc_ar || '', suggested: variantText } },
          });
        } else {
          events.push({ store_id: store.id, event_type: 'diagnosis', category: 'product', related_product_id: pid, requires_approval: false, title: `تحويل ضعيف: ${productName(product)}`, description: `${agg.views} مشاهدة بس ${agg.purchases} مبيعة فقط (تحويل ${productConversionPct.toFixed(1)}% مقابل متوسط المتجر ${storeConversionPct.toFixed(1)}%). المشكلة على الأغلب بصفحة المنتج (الصورة/السعر/الوصف) مش بجذب الزوار.`, data: { diagnosis_key: key, views: agg.views, purchases: agg.purchases, product_cvr: productConversionPct, store_cvr: storeConversionPct } });
        }
      }
    }
  }

  if (totalViews >= MIN_STORE_VIEWS_FOR_BENCHMARK) {
    const benchmarkCvr = bench['conversion_rate:global:cvr'];
    if (benchmarkCvr && storeConversionPct < benchmarkCvr * 0.5) {
      const key = 'low_store_conversion';
      if (!(await alreadyDiagnosedRecently(store.id, key, null))) {
        events.push({ store_id: store.id, event_type: 'diagnosis', category: 'store', related_product_id: null, requires_approval: false, title: 'معدل تحويل المتجر أقل من معيار السوق', description: `معدل تحويل المتجر ${storeConversionPct.toFixed(2)}% مقابل متوسط السوق العالمي ${benchmarkCvr}%. يستاهل مراجعة تجربة الشراء ككل (سرعة الموقع، وضوح السعر، خطوات الدفع).`, data: { diagnosis_key: key, store_cvr: storeConversionPct, benchmark_cvr: benchmarkCvr, total_views: totalViews, total_purchases: totalPurchases } });
      }
    }
  }

  try {
    const [abandonedRows, ordersRows] = await Promise.all([
      sbGet(`abandoned_carts?store_id=eq.${store.id}&created_at=gte.${sinceDate}T00:00:00Z&select=id`),
      sbGet(`orders?store_id=eq.${store.id}&date=gte.${sinceDate}&status=neq.cancelled&select=id`),
    ]);
    const sample = abandonedRows.length + ordersRows.length;
    if (sample >= MIN_CART_SAMPLE) {
      const abandonmentPct = (abandonedRows.length / sample) * 100;
      const benchmarkAbandonment = bench['cart_abandonment:mena:abandonment_rate'] || bench['cart_abandonment:global:abandonment_rate'];
      if (benchmarkAbandonment && abandonmentPct > benchmarkAbandonment * 1.1) {
        const key = 'high_cart_abandonment';
        if (!(await alreadyDiagnosedRecently(store.id, key, null))) {
          events.push({ store_id: store.id, event_type: 'diagnosis', category: 'cart', related_product_id: null, requires_approval: false, title: 'نسبة تخلي عن السلة أعلى من الطبيعي', description: `${abandonedRows.length} سلة متروكة مقابل ${ordersRows.length} طلب مكتمل (نسبة تخلي ${abandonmentPct.toFixed(0)}% مقابل معيار السوق ${benchmarkAbandonment}%). تأكد إنه رسائل واتساب لتذكير السلات المتروكة مفعّلة، وراجع خطوات الدفع.`, data: { diagnosis_key: key, abandoned: abandonedRows.length, orders: ordersRows.length, abandonment_pct: abandonmentPct, benchmark_pct: benchmarkAbandonment } });
        }
      }
    }
  } catch (e) { console.error(`cart abandonment check failed for store ${store.id}:`, e?.message); }

  try {
    const adRows = await sbGet(`ad_campaigns_daily?store_id=eq.${store.id}&stat_date=gte.${sinceDate}&select=platform,campaign_id,campaign_name,spend,clicks,impressions`);
    const byPlatform = {};
    for (const r of adRows) {
      if (!byPlatform[r.platform]) byPlatform[r.platform] = { spend: 0, clicks: 0, impressions: 0 };
      byPlatform[r.platform].spend += Number(r.spend || 0);
      byPlatform[r.platform].clicks += Number(r.clicks || 0);
      byPlatform[r.platform].impressions += Number(r.impressions || 0);
    }
    for (const [platform, agg] of Object.entries(byPlatform)) {
      if (agg.impressions < 1000) continue;
      const ctrPct = (agg.clicks / agg.impressions) * 100;
      const benchmarkCtr = bench[`${platform}_ads:global:ctr`];
      if (benchmarkCtr && ctrPct < benchmarkCtr * 0.5) {
        const key = `low_ctr_${platform}`;
        if (!(await alreadyDiagnosedRecently(store.id, key, null))) {
          const platformName = platform === 'meta' ? 'Meta (فيسبوك/إنستغرام)' : 'TikTok';
          events.push({ store_id: store.id, event_type: 'diagnosis', category: 'ad', related_product_id: null, requires_approval: false, title: `نسبة نقر ضعيفة على إعلانات ${platformName}`, description: `نسبة النقر ${ctrPct.toFixed(2)}% مقابل معيار السوق ${benchmarkCtr}%. صرفت ${agg.spend.toFixed(0)}$ على ${agg.impressions} ظهور. المشكلة على الأغلب بالمحتوى الإعلاني نفسه (الصورة/الفيديو) مش بالجمهور المستهدف — جرّب تجديد المحتوى.`, data: { diagnosis_key: key, platform, ctr_pct: ctrPct, benchmark_ctr: benchmarkCtr, spend: agg.spend, impressions: agg.impressions } });
        }
      }
    }
  } catch (e) { console.error(`ad performance check failed for store ${store.id}:`, e?.message); }

  return events;
}

async function runDiagnose() {
  const sinceDate = daysAgoISODate(WINDOW_DAYS);
  const summary = { window: `${sinceDate} → today`, storesProcessed: 0, diagnosesCreated: 0, errors: [] };
  const stores = await sbGet('stores?status=eq.active&select=id,name,join_date');
  const benchmarkRows = await sbGet('market_benchmarks?select=category,segment,metric_key,metric_avg');
  const bench = {};
  for (const b of benchmarkRows) bench[`${b.category}:${b.segment}:${b.metric_key}`] = Number(b.metric_avg);

  for (const store of stores) {
    try {
      const newEvents = await diagnoseStore(store, sinceDate, bench);
      if (newEvents.length) { await sbInsert('store_growth_events', newEvents); summary.diagnosesCreated += newEvents.length; }
      summary.storesProcessed++;
    } catch (storeErr) {
      summary.errors.push({ store_id: store.id, message: storeErr?.message });
      console.error(`diagnose failed for store ${store.id}:`, storeErr);
    }
  }
  return summary;
}

// ============================================================
// 4) EXECUTE-ACTION — موافقة/رفض إجراء من صاحب المتجر
// ============================================================

async function executeAction(event) {
  const actionType = event.data?.action_type;
  if (actionType === 'hide_product' && event.related_product_id) {
    await hideProduct(event.related_product_id);
    return { executed: true, action_type: actionType };
  }
  if (actionType === 'apply_product_variant' && event.related_product_id && event.data?.variant) {
    const { field, suggested } = event.data.variant;
    if (!['desc_ar'].includes(field)) throw new Error(`Unsupported variant field: ${field}`);
    await sbPatch('products', `id=eq.${event.related_product_id}`, { [field]: suggested });
    return { executed: true, action_type: actionType };
  }
  throw new Error(`Unknown or unsupported action_type: ${actionType}`);
}

async function handleExecuteAction(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { event_id: eventId, decision } = req.body || {};
  if (!token || !eventId || !['approve', 'reject'].includes(decision)) { res.status(400).json({ error: 'Missing token, event_id, or invalid decision' }); return; }

  const user = await getUserFromToken(token);
  if (!user?.id) { res.status(401).json({ error: 'Invalid session' }); return; }

  const [event] = await sbGet(`store_growth_events?id=eq.${eventId}&select=*`);
  if (!event) { res.status(404).json({ error: 'Event not found' }); return; }

  const stores = await sbGet(`stores?id=eq.${event.store_id}&owner_id=eq.${user.id}&select=id`);
  if (!stores.length) { res.status(403).json({ error: 'Not your store' }); return; }
  if (event.status !== 'pending') { res.status(409).json({ error: 'Event already resolved' }); return; }
  if (event.event_type !== 'suggested_action') { res.status(400).json({ error: 'This event does not require a decision' }); return; }

  if (decision === 'reject') {
    await sbPatch('store_growth_events', `id=eq.${eventId}`, { status: 'rejected', resolved_at: new Date().toISOString() });
    res.status(200).json({ status: 'rejected' });
    return;
  }
  await executeAction(event);
  await sbPatch('store_growth_events', `id=eq.${eventId}`, { status: 'approved', resolved_at: new Date().toISOString() });
  res.status(200).json({ status: 'approved', executed: true });
}

// ============================================================
// 5) CAPTURE-RESULTS — قياس نتيجة الإجراءات بعد أسبوع
// ============================================================

async function storeRevenueBetween(storeId, fromDate, toDate) {
  const rows = await sbGet(`product_daily_stats?store_id=eq.${storeId}&stat_date=gte.${fromDate}&stat_date=lt.${toDate}&select=revenue,purchases`);
  return { revenue: rows.reduce((s, r) => s + Number(r.revenue || 0), 0), purchases: rows.reduce((s, r) => s + Number(r.purchases || 0), 0) };
}

async function runCaptureResults() {
  const summary = { eventsProcessed: 0, errors: [] };
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const events = await sbGet(`store_growth_events?event_type=in.(suggested_action,auto_action)&status=in.(approved,auto_executed)&resolved_at=lte.${sevenDaysAgo}&result_snapshot=is.null&select=id,store_id,resolved_at,data`);

  for (const event of events) {
    try {
      const resolvedAt = new Date(event.resolved_at);
      const before = isoDate(new Date(resolvedAt.getTime() - 7 * 86400000));
      const atResolve = isoDate(resolvedAt);
      const after = isoDate(new Date(resolvedAt.getTime() + 7 * 86400000));
      const [beforeStats, afterStats] = await Promise.all([storeRevenueBetween(event.store_id, before, atResolve), storeRevenueBetween(event.store_id, atResolve, after)]);
      const pct = beforeStats.revenue > 0 ? ((afterStats.revenue - beforeStats.revenue) / beforeStats.revenue) * 100 : null;
      const snapshot = { measured_at: new Date().toISOString(), store_revenue_before: beforeStats.revenue, store_revenue_after: afterStats.revenue, store_purchases_before: beforeStats.purchases, store_purchases_after: afterStats.purchases, pct_change: pct, note: 'هاد مقياس على مستوى المتجر ككل (مو معزول تماماً عن باقي التغيرات) — إشارة أولية مو دليل قاطع.' };
      await sbPatch('store_growth_events', `id=eq.${event.id}`, { result_snapshot: snapshot });
      summary.eventsProcessed++;
    } catch (evErr) { summary.errors.push({ event_id: event.id, message: evErr?.message }); }
  }
  return summary;
}

// ============================================================
// 6) MONTHLY-PLAN — تقييم مرحلة النمو الشهري + خطة أولويات مخصصة
// ============================================================

async function revenueWindow(storeId, from, to) {
  const rows = await sbGet(`product_daily_stats?store_id=eq.${storeId}&stat_date=gte.${from}&stat_date=lt.${to}&select=revenue,purchases,views`);
  return { revenue: rows.reduce((s, r) => s + Number(r.revenue || 0), 0), purchases: rows.reduce((s, r) => s + Number(r.purchases || 0), 0), views: rows.reduce((s, r) => s + Number(r.views || 0), 0) };
}
async function cartAbandonmentWindow(storeId, from, to) {
  const [abandoned, orders] = await Promise.all([
    sbGet(`abandoned_carts?store_id=eq.${storeId}&created_at=gte.${from}T00:00:00Z&created_at=lt.${to}T00:00:00Z&select=id`),
    sbGet(`orders?store_id=eq.${storeId}&date=gte.${from}&date=lt.${to}&status=neq.cancelled&select=id`),
  ]);
  const sample = abandoned.length + orders.length;
  return { abandoned: abandoned.length, orders: orders.length, pct: sample >= 5 ? (abandoned.length / sample) * 100 : null };
}
async function adSpendWindow(storeId, from, to) {
  const rows = await sbGet(`ad_campaigns_daily?store_id=eq.${storeId}&stat_date=gte.${from}&stat_date=lt.${to}&select=spend,clicks,impressions`);
  if (!rows.length) return null;
  return { spend: rows.reduce((s, r) => s + Number(r.spend || 0), 0), clicks: rows.reduce((s, r) => s + Number(r.clicks || 0), 0), impressions: rows.reduce((s, r) => s + Number(r.impressions || 0), 0) };
}
async function eventCategoryCounts(storeId, from) {
  const rows = await sbGet(`store_growth_events?store_id=eq.${storeId}&created_at=gte.${from}T00:00:00Z&select=category`);
  const counts = {}; for (const r of rows) counts[r.category] = (counts[r.category] || 0) + 1;
  return counts;
}
function classifyStage({ storeAgeDays, ordersThisPeriod, revenuePct }) {
  if (storeAgeDays < LAUNCH_MAX_AGE_DAYS || ordersThisPeriod < LAUNCH_MIN_ORDERS) return { stage: 'launch', label: 'الانطلاق' };
  if (revenuePct >= 20) return { stage: 'rapid_growth', label: 'نمو متسارع' };
  if (revenuePct >= 0) return { stage: 'steady_growth', label: 'نمو مستقر' };
  if (revenuePct >= -15) return { stage: 'plateau', label: 'ركود' };
  return { stage: 'decline', label: 'تراجع' };
}
function buildSummary({ stageInfo, revenue, revenuePct, orders, cart, ads, storeName }) {
  const dir = revenuePct > 0 ? 'زيادة' : revenuePct < 0 ? 'انخفاض' : 'ثبات';
  let s = `متجر ${storeName} بمرحلة "${stageInfo.label}" هلأ. الإيراد آخر 30 يوم ${revenue.after.toLocaleString()} مقابل ${revenue.before.toLocaleString()} بالفترة اللي قبلها — يعني ${dir} بنسبة ${Math.abs(revenuePct).toFixed(1)}%، وعدد الطلبات ${orders}.`;
  if (cart?.pct != null) s += ` نسبة التخلي عن السلة ${cart.pct.toFixed(0)}%.`;
  s += ads ? ` صُرف ${ads.spend.toFixed(0)}$ على الإعلانات هالشهر بـ${ads.clicks} نقرة.` : ` ما في حساب إعلانات مربوط بعد.`;
  return s;
}
function buildPriorities({ stageInfo, categoryCounts, ads }) {
  const priorities = [];
  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const categoryLabels = {
    product: { title: 'راجع منتجاتك الراكدة وضعيفة التحويل', description: 'في أكتر من مؤشر هالشهر على منتجات محتاجة تحسين صور أو أسعار أو إخفاء.' },
    store: { title: 'حسّن تجربة الشراء العامة', description: 'معدل التحويل العام للمتجر أقل من معيار السوق — راجع سرعة الموقع ووضوح خطوات الدفع.' },
    cart: { title: 'فعّل متابعة السلات المتروكة بشكل أقوى', description: 'نسبة تخلي عن السلة أعلى من الطبيعي — رسائل واتساب سريعة بالساعة الأولى بتساعد كتير.' },
    ad: { title: 'جدّد محتوى إعلاناتك', description: 'أداء الإعلانات أقل من معيار السوق — المشكلة غالباً بالمحتوى الإعلاني نفسه.' },
  };
  for (const [cat, count] of sortedCategories.slice(0, 2)) if (categoryLabels[cat]) priorities.push({ ...categoryLabels[cat], category: cat, signal_count: count });

  if (stageInfo.stage === 'launch') {
    priorities.push({ title: 'اكمل تعبئة كتالوج منتجاتك', description: 'كل ما زاد عدد المنتجات المعروضة بجودة كل ما زادت فرصة أول مبيعة.', category: 'stage' });
    priorities.push({ title: 'اجمع أول تقييمات من عملائك', description: 'التقييمات المبكرة بتبني ثقة أسرع من أي شي تاني بهاي المرحلة.', category: 'stage' });
  } else if (stageInfo.stage === 'plateau' || stageInfo.stage === 'decline') {
    priorities.push({ title: 'جرّب قناة تسويق جديدة أو عرض واضح', description: 'النمو العضوي وقف — الوقت المناسب لضخ زخم خارجي (إعلان، تعاون، خصم محدود).', category: 'stage' });
  } else if (stageInfo.stage === 'rapid_growth') {
    priorities.push({ title: 'تأكد إنه المخزون والتوصيل مجاريين النمو', description: 'نمو سريع بدون جاهزية تشغيلية بيرجع يضر بتجربة العميل.', category: 'stage' });
  }
  if (!ads && stageInfo.stage !== 'launch') priorities.push({ title: 'اربط حساب إعلاناتك (Meta أو TikTok)', description: 'بدون ربط، وكيل النمو ما بيقدر يشخص أداء إعلاناتك — من صفحة الإعدادات.', category: 'ad' });
  return priorities.slice(0, 5);
}

async function runMonthlyPlan() {
  const now = new Date();
  const periodEnd = isoDate(now);
  const periodStart = isoDate(new Date(now.getTime() - 30 * 86400000));
  const priorStart = isoDate(new Date(now.getTime() - 60 * 86400000));
  const summary = { periodStart, periodEnd, storesProcessed: 0, errors: [] };
  const stores = await sbGet('stores?status=eq.active&select=id,name,join_date');

  for (const store of stores) {
    try {
      const [revenueAfter, revenueBefore, cart, ads, categoryCounts] = await Promise.all([
        revenueWindow(store.id, periodStart, periodEnd),
        revenueWindow(store.id, priorStart, periodStart),
        cartAbandonmentWindow(store.id, periodStart, periodEnd),
        adSpendWindow(store.id, periodStart, periodEnd),
        eventCategoryCounts(store.id, periodStart),
      ]);
      if (revenueAfter.views === 0 && revenueBefore.views === 0 && revenueAfter.purchases === 0) continue;

      const storeAgeDays = store.join_date ? (now.getTime() - new Date(store.join_date).getTime()) / 86400000 : 0;
      const revenuePct = pctChange(revenueBefore.revenue, revenueAfter.revenue);
      const stageInfo = classifyStage({ storeAgeDays, ordersThisPeriod: revenueAfter.purchases, revenuePct });
      const summaryText = buildSummary({ stageInfo, revenue: { before: revenueBefore.revenue, after: revenueAfter.revenue }, revenuePct, orders: revenueAfter.purchases, cart, ads, storeName: store.name });
      const priorities = buildPriorities({ stageInfo, categoryCounts, ads });

      await sbUpsert('store_growth_plans', [{
        store_id: store.id, period_start: periodStart, period_end: periodEnd, stage: stageInfo.stage, stage_label_ar: stageInfo.label, summary: summaryText, priorities,
        metrics: { revenue_before: revenueBefore.revenue, revenue_after: revenueAfter.revenue, revenue_pct_change: revenuePct, orders_before: revenueBefore.purchases, orders_after: revenueAfter.purchases, views_before: revenueBefore.views, views_after: revenueAfter.views, cart_abandonment_pct: cart.pct, ad_spend: ads?.spend ?? null, ad_clicks: ads?.clicks ?? null, store_age_days: Math.floor(storeAgeDays), category_counts: categoryCounts },
      }], 'store_id,period_end');
      summary.storesProcessed++;
    } catch (storeErr) {
      summary.errors.push({ store_id: store.id, message: storeErr?.message });
      console.error(`monthly-plan failed for store ${store.id}:`, storeErr);
    }
  }
  return summary;
}

// ============================================================
// 7) OAUTH — ربط حسابات Meta / TikTok Ads
// ============================================================

async function handleManualConnect(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { store_id: storeId, platform, external_account_id: accountId, access_token: accessToken } = req.body || {};
  if (!token || !storeId || !['meta', 'tiktok'].includes(platform) || !accountId || !accessToken) {
    res.status(400).json({ error: 'Missing required fields' }); return;
  }

  const user = await getUserFromToken(token);
  if (!user?.id) { res.status(401).json({ error: 'Invalid session' }); return; }

  const stores = await sbGet(`stores?id=eq.${storeId}&owner_id=eq.${user.id}&select=id`);
  if (!stores.length) { res.status(403).json({ error: 'Store does not belong to this user' }); return; }

  // تحقق فعلي من صلاحية التوكن قبل الحفظ — ما بنخزن توكن ما اختبرناه
  let accountName = accountId;
  try {
    if (platform === 'meta') {
      const cleanId = accountId.replace(/^act_/, '');
      const r = await fetch(`https://graph.facebook.com/v19.0/act_${cleanId}?fields=name,account_status&access_token=${accessToken}`);
      if (!r.ok) { res.status(400).json({ error: 'التوكن أو رقم الحساب غير صحيح — تحقق منهم وحاول من جديد' }); return; }
      const data = await r.json();
      accountName = data.name || cleanId;
      await sbUpsert('ad_accounts', [{ store_id: storeId, platform: 'meta', external_account_id: cleanId, external_account_name: accountName, access_token: accessToken, token_expires_at: null, status: 'connected', connected_by: user.id }], 'store_id,platform,external_account_id');
    } else {
      const r = await fetch(`https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify([accountId]))}`, { headers: { 'Access-Token': accessToken } });
      const data = await r.json();
      const info = data?.data?.list?.[0];
      if (!info) { res.status(400).json({ error: 'التوكن أو رقم الحساب غير صحيح — تحقق منهم وحاول من جديد' }); return; }
      accountName = info.name || accountId;
      await sbUpsert('ad_accounts', [{ store_id: storeId, platform: 'tiktok', external_account_id: accountId, external_account_name: accountName, access_token: accessToken, token_expires_at: null, status: 'connected', connected_by: user.id }], 'store_id,platform,external_account_id');
    }
  } catch (e) {
    console.error('manual connect verification failed:', e);
    res.status(400).json({ error: 'فشل التحقق من التوكن — تأكد إنه فعّال وله صلاحية ads_read' });
    return;
  }

  res.status(200).json({ connected: true, account_name: accountName });
}

async function handleOAuthStart(req, res, platform) {
  const appId = platform === 'meta' ? process.env.META_APP_ID : process.env.TIKTOK_APP_ID;
  const redirectUri = platform === 'meta' ? process.env.META_OAUTH_REDIRECT_URI : process.env.TIKTOK_OAUTH_REDIRECT_URI;
  if (!appId || !redirectUri) { res.status(200).json({ configured: false, message: `${platform === 'meta' ? 'Meta' : 'TikTok'} App not configured yet — يحتاج env vars بالسيرفر.` }); return; }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { store_id: storeId } = req.body || {};
  if (!token || !storeId) { res.status(400).json({ error: 'Missing token or store_id' }); return; }

  const user = await getUserFromToken(token);
  if (!user?.id) { res.status(401).json({ error: 'Invalid session' }); return; }

  const stores = await sbGet(`stores?id=eq.${storeId}&owner_id=eq.${user.id}&select=id`);
  if (!stores.length) { res.status(403).json({ error: 'Store does not belong to this user' }); return; }

  const [intent] = await (async () => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/oauth_connect_intents`, { method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify({ store_id: storeId, platform, created_by: user.id }) });
    return r.json();
  })();
  if (!intent?.id) { res.status(500).json({ error: 'Failed to create connect intent' }); return; }

  let authUrl;
  if (platform === 'meta') {
    authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', intent.id);
    authUrl.searchParams.set('scope', 'ads_read,business_management');
  } else {
    authUrl = new URL('https://business-api.tiktok.com/portal/auth');
    authUrl.searchParams.set('app_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', intent.id);
  }
  res.status(200).json({ configured: true, authUrl: authUrl.toString() });
}

function redirectWithMessage(res, ok, message) {
  res.writeHead(302, { Location: `/dashboard/settings?ad_connect=${ok ? 'success' : 'error'}&msg=${encodeURIComponent(message)}` });
  res.end();
}

async function handleOAuthCallback(req, res, platform) {
  if (platform === 'meta') {
    const appId = process.env.META_APP_ID, appSecret = process.env.META_APP_SECRET, redirectUri = process.env.META_OAUTH_REDIRECT_URI;
    if (!appId || !appSecret || !redirectUri) { redirectWithMessage(res, false, 'Meta App غير مفعّل بعد على السيرفر'); return; }
    const { code, state, error: oauthError } = req.query;
    if (oauthError) { redirectWithMessage(res, false, 'رفض التاجر الربط أو صار خطأ بـ Meta'); return; }
    if (!code || !state) { redirectWithMessage(res, false, 'رد ناقص من Meta'); return; }
    try {
      const [intent] = await sbGet(`oauth_connect_intents?id=eq.${state}&used=eq.false&select=*`);
      if (!intent || new Date(intent.expires_at) < new Date()) { redirectWithMessage(res, false, 'انتهت صلاحية طلب الربط، حاول من جديد'); return; }

      const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
      tokenUrl.searchParams.set('client_id', appId); tokenUrl.searchParams.set('client_secret', appSecret); tokenUrl.searchParams.set('redirect_uri', redirectUri); tokenUrl.searchParams.set('code', code);
      const tokenRes = await fetch(tokenUrl.toString());
      if (!tokenRes.ok) { redirectWithMessage(res, false, 'فشل تبديل الكود بتوكن'); return; }
      const tokenData = await tokenRes.json();

      const longTokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
      longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token'); longTokenUrl.searchParams.set('client_id', appId); longTokenUrl.searchParams.set('client_secret', appSecret); longTokenUrl.searchParams.set('fb_exchange_token', tokenData.access_token);
      const longTokenRes = await fetch(longTokenUrl.toString());
      const longTokenData = longTokenRes.ok ? await longTokenRes.json() : null;
      const finalToken = longTokenData?.access_token || tokenData.access_token;
      const expiresInSec = longTokenData?.expires_in || tokenData.expires_in || 5184000;

      const adAccountsRes = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name&access_token=${finalToken}`);
      const adAccountsData = adAccountsRes.ok ? await adAccountsRes.json() : { data: [] };
      const firstAccount = adAccountsData?.data?.[0];
      if (!firstAccount) { redirectWithMessage(res, false, 'ما لقينا حساب إعلانات مربوط بحسابك على Meta'); return; }

      await sbUpsert('ad_accounts', [{ store_id: intent.store_id, platform: 'meta', external_account_id: firstAccount.account_id, external_account_name: firstAccount.name, access_token: finalToken, token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(), status: 'connected', connected_by: intent.created_by }], 'store_id,platform,external_account_id');
      await sbPatch('oauth_connect_intents', `id=eq.${intent.id}`, { used: true });
      redirectWithMessage(res, true, `تم ربط حساب ${firstAccount.name}`);
    } catch (err) { console.error('meta oauth callback error:', err); redirectWithMessage(res, false, 'صار خطأ غير متوقع أثناء الربط'); }
    return;
  }

  const appId = process.env.TIKTOK_APP_ID, appSecret = process.env.TIKTOK_APP_SECRET;
  if (!appId || !appSecret) { redirectWithMessage(res, false, 'TikTok App غير مفعّل بعد على السيرفر'); return; }
  const { auth_code: authCode, state } = req.query;
  if (!authCode || !state) { redirectWithMessage(res, false, 'رد ناقص من TikTok'); return; }
  try {
    const [intent] = await sbGet(`oauth_connect_intents?id=eq.${state}&used=eq.false&select=*`);
    if (!intent || new Date(intent.expires_at) < new Date()) { redirectWithMessage(res, false, 'انتهت صلاحية طلب الربط، حاول من جديد'); return; }

    const tokenRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_id: appId, secret: appSecret, auth_code: authCode }) });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.data?.access_token;
    const advertiserIds = tokenData?.data?.advertiser_ids || [];
    if (!accessToken || !advertiserIds.length) { redirectWithMessage(res, false, 'ما لقينا حساب إعلانات مربوط بحسابك على TikTok'); return; }

    const firstAdvertiserId = advertiserIds[0];
    let advertiserName = firstAdvertiserId;
    try {
      const infoRes = await fetch(`https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify([firstAdvertiserId]))}`, { headers: { 'Access-Token': accessToken } });
      const infoData = await infoRes.json();
      advertiserName = infoData?.data?.list?.[0]?.name || firstAdvertiserId;
    } catch { /* اسم افتراضي كافي لو فشل */ }

    await sbUpsert('ad_accounts', [{ store_id: intent.store_id, platform: 'tiktok', external_account_id: firstAdvertiserId, external_account_name: advertiserName, access_token: accessToken, token_expires_at: null, status: 'connected', connected_by: intent.created_by }], 'store_id,platform,external_account_id');
    await sbPatch('oauth_connect_intents', `id=eq.${intent.id}`, { used: true });
    redirectWithMessage(res, true, `تم ربط حساب ${advertiserName}`);
  } catch (err) { console.error('tiktok oauth callback error:', err); redirectWithMessage(res, false, 'صار خطأ غير متوقع أثناء الربط'); }
}

// ============================================================
// المعالج الرئيسي (dispatcher) — نقطة الدخول الوحيدة
// ============================================================

export default async function handler(req, res) {
  if (!SUPABASE_KEY) { res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY env var' }); return; }

  const q = req.method === 'GET' ? req.query : (req.body || {});
  const action = req.query?.action || q.action;
  const platform = req.query?.platform || q.platform;

  try {
    switch (action) {
      case 'sync': return res.status(200).json(await runSync(q.date));
      case 'ads-sync': return res.status(200).json(await runAdsSync(q.date));
      case 'diagnose': return res.status(200).json(await runDiagnose());
      case 'capture-results': return res.status(200).json(await runCaptureResults());
      case 'monthly-plan': return res.status(200).json(await runMonthlyPlan());
      case 'execute-action':
        if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
        return await handleExecuteAction(req, res);
      case 'oauth-start':
        if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
        if (!['meta', 'tiktok'].includes(platform)) { res.status(400).json({ error: 'Invalid platform' }); return; }
        return await handleOAuthStart(req, res, platform);
      case 'connect-manual':
        if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
        return await handleManualConnect(req, res);
      case 'oauth-callback':
        if (!['meta', 'tiktok'].includes(platform)) { res.status(400).json({ error: 'Invalid platform' }); return; }
        return await handleOAuthCallback(req, res, platform);
      default: {
        const now = new Date();
        const isSunday = now.getUTCDay() === 0;
        const isFirstOfMonth = now.getUTCDate() === 1;
        const results = {};
        try { results.sync = await runSync(); } catch (e) { results.sync = { error: e?.message }; }
        try { results.adsSync = await runAdsSync(); } catch (e) { results.adsSync = { error: e?.message }; }
        try { results.diagnose = await runDiagnose(); } catch (e) { results.diagnose = { error: e?.message }; }
        if (isSunday) { try { results.captureResults = await runCaptureResults(); } catch (e) { results.captureResults = { error: e?.message }; } }
        if (isFirstOfMonth) { try { results.monthlyPlan = await runMonthlyPlan(); } catch (e) { results.monthlyPlan = { error: e?.message }; } }
        return res.status(200).json({ ranAt: now.toISOString(), isSunday, isFirstOfMonth, results });
      }
    }
  } catch (err) {
    console.error(`growth-agent action=${action} error:`, err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
