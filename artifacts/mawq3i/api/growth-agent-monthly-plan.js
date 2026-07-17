// ============================================================
// Growth Agent — التقييم الشهري لمرحلة النمو + خطة مخصصة
// يقارن آخر 30 يوم بالـ30 يوم اللي قبلها (إيراد، طلبات، تخلي عن سلة،
// أداء إعلانات لو مربوطة، تكرار كل نوع تشخيص)، يحدد مرحلة نمو المتجر،
// ويبني خطة أولويات مبنية فعلياً على بياناته — مو نص عام.
//
// Cron: أول كل شهر. يدوياً: GET/POST /api/growth-agent-monthly-plan
// ============================================================

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LAUNCH_MAX_AGE_DAYS = 60; // متجر أصغر من هيك يُصنّف "انطلاق" بغض النظر عن الأرقام
const LAUNCH_MIN_ORDERS = 10;   // أو أقل من هيك طلبات بالشهر، حتى لو أقدم

function sbHeaders(extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...extra };
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

function isoDate(d) { return d.toISOString().slice(0, 10); }
function pctChange(before, after) {
  if (before <= 0) return after > 0 ? 100 : 0;
  return ((after - before) / before) * 100;
}

async function revenueWindow(storeId, from, to) {
  const rows = await sbGet(`product_daily_stats?store_id=eq.${storeId}&stat_date=gte.${from}&stat_date=lt.${to}&select=revenue,purchases,views`);
  return {
    revenue: rows.reduce((s, r) => s + Number(r.revenue || 0), 0),
    purchases: rows.reduce((s, r) => s + Number(r.purchases || 0), 0),
    views: rows.reduce((s, r) => s + Number(r.views || 0), 0),
  };
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
  return {
    spend: rows.reduce((s, r) => s + Number(r.spend || 0), 0),
    clicks: rows.reduce((s, r) => s + Number(r.clicks || 0), 0),
    impressions: rows.reduce((s, r) => s + Number(r.impressions || 0), 0),
  };
}

async function eventCategoryCounts(storeId, from) {
  const rows = await sbGet(`store_growth_events?store_id=eq.${storeId}&created_at=gte.${from}T00:00:00Z&select=category`);
  const counts = {};
  for (const r of rows) counts[r.category] = (counts[r.category] || 0) + 1;
  return counts;
}

function classifyStage({ storeAgeDays, ordersThisPeriod, revenuePct }) {
  if (storeAgeDays < LAUNCH_MAX_AGE_DAYS || ordersThisPeriod < LAUNCH_MIN_ORDERS) {
    return { stage: 'launch', label: 'الانطلاق' };
  }
  if (revenuePct >= 20) return { stage: 'rapid_growth', label: 'نمو متسارع' };
  if (revenuePct >= 0) return { stage: 'steady_growth', label: 'نمو مستقر' };
  if (revenuePct >= -15) return { stage: 'plateau', label: 'ركود' };
  return { stage: 'decline', label: 'تراجع' };
}

function buildSummary({ stageInfo, revenue, revenuePct, orders, cart, ads, storeName }) {
  const dir = revenuePct > 0 ? 'زيادة' : revenuePct < 0 ? 'انخفاض' : 'ثبات';
  let s = `متجر ${storeName} بمرحلة "${stageInfo.label}" هلأ. الإيراد آخر 30 يوم ${revenue.after.toLocaleString()} مقابل ${revenue.before.toLocaleString()} بالفترة اللي قبلها — يعني ${dir} بنسبة ${Math.abs(revenuePct).toFixed(1)}%، وعدد الطلبات ${orders}.`;
  if (cart?.pct != null) {
    s += ` نسبة التخلي عن السلة ${cart.pct.toFixed(0)}%.`;
  }
  if (ads) {
    s += ` صُرف ${ads.spend.toFixed(0)}$ على الإعلانات هالشهر بـ${ads.clicks} نقرة.`;
  } else {
    s += ` ما في حساب إعلانات مربوط بعد.`;
  }
  return s;
}

function buildPriorities({ stageInfo, categoryCounts, cart, ads, revenuePct }) {
  const priorities = [];

  // أولوية حسب تكرار نوع المشاكل هالشهر (الأكتر تكراراً = الأهم)
  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const categoryLabels = {
    product: { title: 'راجع منتجاتك الراكدة وضعيفة التحويل', description: 'في أكتر من مؤشر هالشهر على منتجات محتاجة تحسين صور أو أسعار أو إخفاء.' },
    store: { title: 'حسّن تجربة الشراء العامة', description: 'معدل التحويل العام للمتجر أقل من معيار السوق — راجع سرعة الموقع ووضوح خطوات الدفع.' },
    cart: { title: 'فعّل متابعة السلات المتروكة بشكل أقوى', description: 'نسبة تخلي عن السلة أعلى من الطبيعي — رسائل واتساب سريعة بالساعة الأولى بتساعد كتير.' },
    ad: { title: 'جدّد محتوى إعلاناتك', description: 'أداء الإعلانات أقل من معيار السوق — المشكلة غالباً بالمحتوى الإعلاني نفسه.' },
  };
  for (const [cat, count] of sortedCategories.slice(0, 2)) {
    if (categoryLabels[cat]) priorities.push({ ...categoryLabels[cat], category: cat, signal_count: count });
  }

  // أولويات حسب مرحلة النمو نفسها (حتى لو ما في تشخيصات كتيرة)
  if (stageInfo.stage === 'launch') {
    priorities.push({ title: 'اكمل تعبئة كتالوج منتجاتك', description: 'كل ما زاد عدد المنتجات المعروضة بجودة كل ما زادت فرصة أول مبيعة.', category: 'stage' });
    priorities.push({ title: 'اجمع أول تقييمات من عملائك', description: 'التقييمات المبكرة بتبني ثقة أسرع من أي شي تاني بهاي المرحلة.', category: 'stage' });
  } else if (stageInfo.stage === 'plateau' || stageInfo.stage === 'decline') {
    priorities.push({ title: 'جرّب قناة تسويق جديدة أو عرض واضح', description: 'النمو العضوي وقف — الوقت المناسب لضخ زخم خارجي (إعلان، تعاون، خصم محدود).', category: 'stage' });
  } else if (stageInfo.stage === 'rapid_growth') {
    priorities.push({ title: 'تأكد إنه المخزون والتوصيل مجاريين النمو', description: 'نمو سريع بدون جاهزية تشغيلية بيرجع يضر بتجربة العميل.', category: 'stage' });
  }

  if (!ads && stageInfo.stage !== 'launch') {
    priorities.push({ title: 'اربط حساب إعلاناتك (Meta أو TikTok)', description: 'بدون ربط، وكيل النمو ما بيقدر يشخص أداء إعلاناتك — من صفحة الإعدادات.', category: 'ad' });
  }

  return priorities.slice(0, 5);
}

export async function runMonthlyPlan() {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var');

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

      if (revenueAfter.views === 0 && revenueBefore.views === 0 && revenueAfter.purchases === 0) continue; // ما في بيانات كافية

      const storeAgeDays = store.join_date ? (now.getTime() - new Date(store.join_date).getTime()) / 86400000 : 0;
      const revenuePct = pctChange(revenueBefore.revenue, revenueAfter.revenue);
      const stageInfo = classifyStage({ storeAgeDays, ordersThisPeriod: revenueAfter.purchases, revenuePct });

      const summaryText = buildSummary({
        stageInfo, revenue: { before: revenueBefore.revenue, after: revenueAfter.revenue }, revenuePct,
        orders: revenueAfter.purchases, cart, ads, storeName: store.name,
      });
      const priorities = buildPriorities({ stageInfo, categoryCounts, cart, ads, revenuePct });

      await sbUpsert('store_growth_plans', [{
        store_id: store.id,
        period_start: periodStart,
        period_end: periodEnd,
        stage: stageInfo.stage,
        stage_label_ar: stageInfo.label,
        summary: summaryText,
        priorities,
        metrics: {
          revenue_before: revenueBefore.revenue, revenue_after: revenueAfter.revenue, revenue_pct_change: revenuePct,
          orders_before: revenueBefore.purchases, orders_after: revenueAfter.purchases,
          views_before: revenueBefore.views, views_after: revenueAfter.views,
          cart_abandonment_pct: cart.pct, ad_spend: ads?.spend ?? null, ad_clicks: ads?.clicks ?? null,
          store_age_days: Math.floor(storeAgeDays), category_counts: categoryCounts,
        },
      }], 'store_id,period_end');

      summary.storesProcessed++;
    } catch (storeErr) {
      summary.errors.push({ store_id: store.id, message: storeErr?.message });
      console.error(`monthly-plan failed for store ${store.id}:`, storeErr);
    }
  }

  return summary;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const summary = await runMonthlyPlan();
    res.status(200).json(summary);
  } catch (err) {
    console.error('growth-agent-monthly-plan error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
