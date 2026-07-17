// ============================================================
// Growth Agent — المرحلة 1: محرك التشخيص القائم على القواعد
// يحلل بيانات كل متجر (من product_daily_stats + orders + abandoned_carts)
// ويقارنها بـ market_benchmarks، ويسجل تشخيصات واضحة بجدول store_growth_events.
//
// هاي مرحلة "تشخيص" بس — ما في أكشن تلقائي هون أبداً (هاد بالمرحلة 3 لاحقاً).
//
// يُستدعى تلقائياً عبر Vercel Cron بعد المزامنة اليومية (انظر vercel.json)، أو يدوياً:
//   GET /api/growth-agent-diagnose?date=2026-07-16
// ============================================================

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// نافذة التحليل: آخر 14 يوم (نفس منطق "منتج راكد" بالوثيقة)
const WINDOW_DAYS = 14;
const MIN_PRODUCT_AGE_DAYS = 14; // ما نشخّص منتج عمره أقل من هيك (لسا ما أخذ فرصة كافية)
const MIN_VIEWS_FOR_CONVERSION_CHECK = 30; // حد أدنى مشاهدات قبل ما نحكم على معدل تحويل منتج
const MIN_STORE_VIEWS_FOR_BENCHMARK = 50;  // حد أدنى مشاهدات إجمالية قبل مقارنة المتجر بالمعيار العام
const MIN_CART_SAMPLE = 5; // حد أدنى (سلات متروكة + طلبات) قبل الحكم على نسبة التخلي
const DEDUP_WINDOW_DAYS = 7; // ما نكرر نفس التشخيص لنفس المتجر/المنتج خلال هاي المدة

// -------- المرحلة 3: قرارات تلقائية محدودة --------
const ACTION_ESCALATION_DAYS = 21; // منتج راكد أكتر من هيك → يترقّى من "تشخيص" إلى "إجراء مقترح"
const TRUST_MIN_STORE_AGE_DAYS = 60; // لازم يمر 60 يوم على المتجر قبل ما نسمح بأي أكشن تلقائي
const TRUST_MIN_APPROVED_ACTIONS = 3; // ولازم يكون التاجر وافق على 3 إجراءات مقترحة سابقة يدوياً

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

async function sbInsert(table, rows) {
  if (!rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`Supabase insert ${table} failed: ${r.status} ${await r.text()}`);
}

function daysAgoISODate(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// تحقق إذا كان في تشخيص مشابه اتسجل مؤخراً — نتجنب التكرار اليومي لنفس المشكلة
async function alreadyDiagnosedRecently(storeId, diagnosisKey, relatedProductId) {
  const since = new Date(Date.now() - DEDUP_WINDOW_DAYS * 86400000).toISOString();
  let path = `store_growth_events?store_id=eq.${storeId}&created_at=gte.${since}&data->>diagnosis_key=eq.${diagnosisKey}&select=id`;
  path += relatedProductId ? `&related_product_id=eq.${relatedProductId}` : `&related_product_id=is.null`;
  const rows = await sbGet(path);
  return rows.length > 0;
}

// هل المتجر "موثوق" كفاية لتنفيذ إجراء تلقائي بدون موافقة؟
// شرطين لازم يتحققوا الاثنين: عمر المتجر ≥60 يوم، و≥3 إجراءات مقترحة سابقة وافق عليها التاجر يدوياً
async function isStoreTrusted(store) {
  if (!store.join_date) return false;
  const ageDays = (Date.now() - new Date(store.join_date).getTime()) / 86400000;
  if (ageDays < TRUST_MIN_STORE_AGE_DAYS) return false;
  const approved = await sbGet(
    `store_growth_events?store_id=eq.${store.id}&event_type=eq.suggested_action&status=eq.approved&select=id&limit=${TRUST_MIN_APPROVED_ACTIONS}`
  );
  return approved.length >= TRUST_MIN_APPROVED_ACTIONS;
}

// تنفيذ فعلي لإخفاء منتج (نفس منطق growth-agent-execute-action.js، مستخدم هون فقط للتنفيذ التلقائي بعد الثقة)
async function hideProduct(productId) {
  await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${productId}`, {
    method: 'PATCH',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ status: 'hidden' }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!SUPABASE_KEY) {
    res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY env var' });
    return;
  }

  const sinceDate = daysAgoISODate(WINDOW_DAYS);
  const summary = { window: `${sinceDate} → today`, storesProcessed: 0, diagnosesCreated: 0, errors: [] };

  try {
    const stores = await sbGet('stores?status=eq.active&select=id,name,join_date');
    const benchmarkRows = await sbGet('market_benchmarks?select=category,segment,metric_key,metric_avg');
    const bench = {};
    for (const b of benchmarkRows) bench[`${b.category}:${b.segment}:${b.metric_key}`] = Number(b.metric_avg);

    for (const store of stores) {
      try {
        const newEvents = await diagnoseStore(store, sinceDate, bench);
        if (newEvents.length) {
          await sbInsert('store_growth_events', newEvents);
          summary.diagnosesCreated += newEvents.length;
        }
        summary.storesProcessed++;
      } catch (storeErr) {
        summary.errors.push({ store_id: store.id, message: storeErr?.message });
        console.error(`growth-agent-diagnose failed for store ${store.id}:`, storeErr);
      }
    }

    res.status(200).json(summary);
  } catch (err) {
    console.error('growth-agent-diagnose handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error', ...summary });
  }
}

async function diagnoseStore(store, sinceDate, bench) {
  const events = [];

  const [stats, products] = await Promise.all([
    sbGet(`product_daily_stats?store_id=eq.${store.id}&stat_date=gte.${sinceDate}&select=product_id,views,purchases,revenue`),
    sbGet(`products?store_id=eq.${store.id}&select=id,name_ar,name_en,status,created_at`),
  ]);

  if (!stats.length) return events; // ما في بيانات كافية بعد لهاد المتجر

  const productMap = {};
  for (const p of products) productMap[p.id] = p;

  // تجميع views/purchases/revenue لكل منتج عبر الـ14 يوم
  const perProduct = {};
  for (const s of stats) {
    const pid = s.product_id;
    if (!perProduct[pid]) perProduct[pid] = { views: 0, purchases: 0, revenue: 0 };
    perProduct[pid].views += s.views || 0;
    perProduct[pid].purchases += s.purchases || 0;
    perProduct[pid].revenue += s.revenue || 0;
  }

  const productName = (p) => p?.name_ar || p?.name_en || 'منتج';

  // -------- قاعدة 1: منتج راكد (صفر مبيعات، عمره كافي، لسا ظاهر) --------
  // بعد ACTION_ESCALATION_DAYS من الركود المستمر: تشخيص عادي → إجراء مقترح (أو تلقائي لو المتجر موثوق)
  const storeTrusted = await isStoreTrusted(store);
  for (const [pid, agg] of Object.entries(perProduct)) {
    const product = productMap[pid];
    if (!product || product.status !== 'visible') continue;
    const productAgeDays = (Date.now() - new Date(product.created_at).getTime()) / 86400000;
    if (productAgeDays < MIN_PRODUCT_AGE_DAYS) continue;
    if (agg.purchases !== 0) continue;

    if (productAgeDays >= ACTION_ESCALATION_DAYS) {
      // إجراء مقترح: إخفاء المنتج
      const key = 'suggest_hide_product';
      if (await alreadyDiagnosedRecently(store.id, key, pid)) continue;
      const baseEvent = {
        store_id: store.id,
        category: 'product',
        related_product_id: pid,
        title: `اقتراح إخفاء: ${productName(product)}`,
        description: `صفر مبيعات خلال آخر ${WINDOW_DAYS} يوم، والمنتج راكد بشكل مستمر (${Math.floor(productAgeDays)} يوم بدون بيعة). اقتراح: إخفاء المنتج مؤقتاً (قابل للتراجع بأي وقت من صفحة المنتجات).`,
        data: { diagnosis_key: key, action_type: 'hide_product', views: agg.views, purchases: agg.purchases, product_age_days: Math.floor(productAgeDays) },
      };
      if (storeTrusted) {
        // متجر موثوق (عمره ≥60 يوم + ≥3 موافقات سابقة) → ننفذ مباشرة ونوثق كـ auto_action
        try {
          await hideProduct(pid);
          events.push({ ...baseEvent, event_type: 'auto_action', requires_approval: false, status: 'auto_executed', resolved_at: new Date().toISOString() });
        } catch (e) {
          console.error(`auto-hide failed for product ${pid}:`, e?.message);
        }
      } else {
        events.push({ ...baseEvent, event_type: 'suggested_action', requires_approval: true });
      }
    } else {
      // لسا بحدود التشخيص العادي (14-21 يوم) — بدون أي أكشن
      const key = 'stagnant_product';
      if (await alreadyDiagnosedRecently(store.id, key, pid)) continue;
      events.push({
        store_id: store.id,
        event_type: 'diagnosis',
        category: 'product',
        related_product_id: pid,
        requires_approval: false,
        title: `منتج راكد: ${productName(product)}`,
        description: `صفر مبيعات خلال آخر ${WINDOW_DAYS} يوم رغم ${agg.views} مشاهدة. لو استمر الوضع، رح نقترح إخفاءه بعد أسبوع.`,
        data: { diagnosis_key: key, views: agg.views, purchases: agg.purchases, window_days: WINDOW_DAYS },
      });
    }
  }

  // -------- حساب معدل تحويل المتجر (لاستخدامه بقاعدة 2 وقاعدة 3) --------
  const totalViews = Object.values(perProduct).reduce((s, a) => s + a.views, 0);
  const totalPurchases = Object.values(perProduct).reduce((s, a) => s + a.purchases, 0);
  const storeConversionPct = totalViews > 0 ? (totalPurchases / totalViews) * 100 : 0;

  // -------- قاعدة 2: مشاهدات عالية + تحويل ضعيف مقارنة بمتوسط المتجر --------
  if (storeConversionPct > 0) {
    for (const [pid, agg] of Object.entries(perProduct)) {
      const product = productMap[pid];
      if (!product || product.status !== 'visible') continue;
      if (agg.views < MIN_VIEWS_FOR_CONVERSION_CHECK) continue;
      const productConversionPct = (agg.purchases / agg.views) * 100;
      if (productConversionPct < storeConversionPct * 0.5) {
        const key = 'low_conversion_product';
        if (await alreadyDiagnosedRecently(store.id, key, pid)) continue;
        events.push({
          store_id: store.id,
          event_type: 'diagnosis',
          category: 'product',
          related_product_id: pid,
          requires_approval: false,
          title: `تحويل ضعيف: ${productName(product)}`,
          description: `${agg.views} مشاهدة بس ${agg.purchases} مبيعة فقط (تحويل ${productConversionPct.toFixed(1)}% مقابل متوسط المتجر ${storeConversionPct.toFixed(1)}%). المشكلة على الأغلب بصفحة المنتج (الصورة/السعر/الوصف) مش بجذب الزوار.`,
          data: { diagnosis_key: key, views: agg.views, purchases: agg.purchases, product_cvr: productConversionPct, store_cvr: storeConversionPct },
        });
      }
    }
  }

  // -------- قاعدة 3: معدل تحويل المتجر ككل مقارنة بمعيار السوق العالمي --------
  if (totalViews >= MIN_STORE_VIEWS_FOR_BENCHMARK) {
    const benchmarkCvr = bench['conversion_rate:global:cvr'];
    if (benchmarkCvr && storeConversionPct < benchmarkCvr * 0.5) {
      const key = 'low_store_conversion';
      if (!(await alreadyDiagnosedRecently(store.id, key, null))) {
        events.push({
          store_id: store.id,
          event_type: 'diagnosis',
          category: 'store',
          related_product_id: null,
          requires_approval: false,
          title: 'معدل تحويل المتجر أقل من معيار السوق',
          description: `معدل تحويل المتجر ${storeConversionPct.toFixed(2)}% مقابل متوسط السوق العالمي ${benchmarkCvr}%. يستاهل مراجعة تجربة الشراء ككل (سرعة الموقع، وضوح السعر، خطوات الدفع).`,
          data: { diagnosis_key: key, store_cvr: storeConversionPct, benchmark_cvr: benchmarkCvr, total_views: totalViews, total_purchases: totalPurchases },
        });
      }
    }
  }

  // -------- قاعدة 4: نسبة التخلي عن السلة مقارنة بمعيار السوق (MENA) --------
  try {
    const [abandonedRows, ordersRows] = await Promise.all([
      sbGet(`abandoned_carts?store_id=eq.${store.id}&created_at=gte.${sinceDate}T00:00:00Z&select=id`),
      sbGet(`orders?store_id=eq.${store.id}&date=gte.${sinceDate}&status=neq.cancelled&select=id`),
    ]);
    const abandonedCount = abandonedRows.length;
    const ordersCount = ordersRows.length;
    const sample = abandonedCount + ordersCount;
    if (sample >= MIN_CART_SAMPLE) {
      const abandonmentPct = (abandonedCount / sample) * 100;
      const benchmarkAbandonment = bench['cart_abandonment:mena:abandonment_rate'] || bench['cart_abandonment:global:abandonment_rate'];
      if (benchmarkAbandonment && abandonmentPct > benchmarkAbandonment * 1.1) {
        const key = 'high_cart_abandonment';
        if (!(await alreadyDiagnosedRecently(store.id, key, null))) {
          events.push({
            store_id: store.id,
            event_type: 'diagnosis',
            category: 'cart',
            related_product_id: null,
            requires_approval: false,
            title: 'نسبة تخلي عن السلة أعلى من الطبيعي',
            description: `${abandonedCount} سلة متروكة مقابل ${ordersCount} طلب مكتمل (نسبة تخلي ${abandonmentPct.toFixed(0)}% مقابل معيار السوق ${benchmarkAbandonment}%). تأكد إنه رسائل واتساب لتذكير السلات المتروكة مفعّلة، وراجع خطوات الدفع.`,
            data: { diagnosis_key: key, abandoned: abandonedCount, orders: ordersCount, abandonment_pct: abandonmentPct, benchmark_pct: benchmarkAbandonment },
          });
        }
      }
    }
  } catch (e) {
    console.error(`cart abandonment check failed for store ${store.id}:`, e?.message);
  }

  // -------- قاعدة 5: أداء الحملات الإعلانية (Meta/TikTok) مقارنة بمعيار السوق --------
  // (يعمل فقط لو عندهم حساب إعلانات مربوط — المرحلة 2)
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
      if (agg.impressions < 1000) continue; // عينة صغيرة جداً، ما نحكم عليها
      const ctrPct = (agg.clicks / agg.impressions) * 100;
      const benchmarkCtr = bench[`${platform}_ads:global:ctr`];
      if (benchmarkCtr && ctrPct < benchmarkCtr * 0.5) {
        const key = `low_ctr_${platform}`;
        if (!(await alreadyDiagnosedRecently(store.id, key, null))) {
          const platformName = platform === 'meta' ? 'Meta (فيسبوك/إنستغرام)' : 'TikTok';
          events.push({
            store_id: store.id,
            event_type: 'diagnosis',
            category: 'ad',
            related_product_id: null,
            requires_approval: false,
            title: `نسبة نقر ضعيفة على إعلانات ${platformName}`,
            description: `نسبة النقر ${ctrPct.toFixed(2)}% مقابل معيار السوق ${benchmarkCtr}%. صرفت ${agg.spend.toFixed(0)}$ على ${agg.impressions} ظهور. المشكلة على الأغلب بالمحتوى الإعلاني نفسه (الصورة/الفيديو) مش بالجمهور المستهدف — جرّب تجديد المحتوى.`,
            data: { diagnosis_key: key, platform, ctr_pct: ctrPct, benchmark_ctr: benchmarkCtr, spend: agg.spend, impressions: agg.impressions },
          });
        }
      }
    }
  } catch (e) {
    console.error(`ad performance check failed for store ${store.id}:`, e?.message);
  }

  return events;
}
