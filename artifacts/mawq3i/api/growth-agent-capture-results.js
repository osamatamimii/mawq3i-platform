// ============================================================
// Growth Agent — المرحلة 4 (تمهيد): قياس نتيجة الإجراءات بعد أسبوع
// لكل إجراء اتنفذ (approved أو auto_executed) من ≥7 أيام وما إله result_snapshot بعد،
// نقارن أداء المتجر (إيراد) بالأسبوع اللي قبل التنفيذ مقابل الأسبوع اللي بعده.
//
// هاد أساس المرحلة 4 (التعلم من بيانات Mawq3i نفسها) — بس فعلياً "التعلم" الحقيقي
// (اكتشاف أنماط موثوقة عبر عشرات المتاجر) ما بيصير قبل ما يتراكم عدد كافي من
// الإجراءات المنفذة عبر متاجر كتار، زي ما موثّق بخارطة الطريق.
//
// GET/POST /api/growth-agent-capture-results — Cron أسبوعي
// ============================================================

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders(extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...extra };
}
async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`Supabase GET ${path} failed: ${r.status} ${await r.text()}`);
  return r.json();
}
async function sbPatch(table, filter, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Supabase patch ${table} failed: ${r.status} ${await r.text()}`);
}

function isoDate(d) { return d.toISOString().slice(0, 10); }

async function storeRevenueBetween(storeId, fromDate, toDate) {
  const rows = await sbGet(`product_daily_stats?store_id=eq.${storeId}&stat_date=gte.${fromDate}&stat_date=lt.${toDate}&select=revenue,purchases`);
  return {
    revenue: rows.reduce((s, r) => s + Number(r.revenue || 0), 0),
    purchases: rows.reduce((s, r) => s + Number(r.purchases || 0), 0),
  };
}

export async function runCaptureResults() {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var');
  const summary = { eventsProcessed: 0, errors: [] };

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const events = await sbGet(
    `store_growth_events?event_type=in.(suggested_action,auto_action)&status=in.(approved,auto_executed)&resolved_at=lte.${sevenDaysAgo}&result_snapshot=is.null&select=id,store_id,resolved_at,data`
  );

  for (const event of events) {
    try {
      const resolvedAt = new Date(event.resolved_at);
      const before = isoDate(new Date(resolvedAt.getTime() - 7 * 86400000));
      const atResolve = isoDate(resolvedAt);
      const after = isoDate(new Date(resolvedAt.getTime() + 7 * 86400000));

      const [beforeStats, afterStats] = await Promise.all([
        storeRevenueBetween(event.store_id, before, atResolve),
        storeRevenueBetween(event.store_id, atResolve, after),
      ]);

      const pctChange = beforeStats.revenue > 0
        ? ((afterStats.revenue - beforeStats.revenue) / beforeStats.revenue) * 100
        : null;

      const snapshot = {
        measured_at: new Date().toISOString(),
        store_revenue_before: beforeStats.revenue,
        store_revenue_after: afterStats.revenue,
        store_purchases_before: beforeStats.purchases,
        store_purchases_after: afterStats.purchases,
        pct_change: pctChange,
        note: 'هاد مقياس على مستوى المتجر ككل (مو معزول تماماً عن باقي التغيرات) — إشارة أولية مو دليل قاطع.',
      };

      await sbPatch('store_growth_events', `id=eq.${event.id}`, { result_snapshot: snapshot });
      summary.eventsProcessed++;
    } catch (evErr) {
      summary.errors.push({ event_id: event.id, message: evErr?.message });
    }
  }

  return summary;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const summary = await runCaptureResults();
    res.status(200).json(summary);
  } catch (err) {
    console.error('growth-agent-capture-results error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
