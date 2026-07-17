// ============================================================
// Growth Agent — المرحلة 2: مزامنة أداء الحملات الإعلانية
// يمر على كل حساب إعلانات مربوط (ad_accounts)، يجيب أداء الأمس من
// Meta Marketing API / TikTok Marketing API، ويخزنه بـ ad_campaigns_daily.
//
// GET/POST /api/growth-agent-ads-sync?date=YYYY-MM-DD (افتراضي: أمس)
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
async function sbUpsert(table, rows, onConflict) {
  if (!rows.length) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`Supabase upsert ${table} failed: ${r.status} ${await r.text()}`);
}

async function syncMetaAccount(account, date) {
  const url = new URL(`https://graph.facebook.com/v19.0/act_${account.external_account_id}/insights`);
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc');
  url.searchParams.set('time_range', JSON.stringify({ since: date, until: date }));
  url.searchParams.set('access_token', account.access_token);

  const r = await fetch(url.toString());
  if (!r.ok) {
    const errText = await r.text();
    if (r.status === 401 || errText.includes('OAuthException')) {
      await sbUpdateAccountStatus(account.id, 'expired');
    }
    throw new Error(`Meta insights failed for account ${account.external_account_id}: ${r.status} ${errText}`);
  }
  const data = await r.json();
  return (data.data || []).map((row) => ({
    store_id: account.store_id,
    platform: 'meta',
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    stat_date: date,
    spend: Number(row.spend || 0),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    ctr: row.ctr != null ? Number(row.ctr) : null,
    cpc: row.cpc != null ? Number(row.cpc) : null,
  }));
}

async function syncTikTokAccount(account, date) {
  const r = await fetch('https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/', {
    method: 'POST',
    headers: { 'Access-Token': account.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      advertiser_id: account.external_account_id,
      report_type: 'BASIC',
      data_level: 'AUCTION_CAMPAIGN',
      dimensions: ['campaign_id', 'stat_time_day'],
      metrics: ['campaign_name', 'spend', 'impressions', 'clicks', 'ctr', 'cpc'],
      start_date: date,
      end_date: date,
      page_size: 100,
    }),
  });
  if (!r.ok) throw new Error(`TikTok report failed for account ${account.external_account_id}: ${r.status} ${await r.text()}`);
  const data = await r.json();
  const rows = data?.data?.list || [];
  return rows.map((row) => ({
    store_id: account.store_id,
    platform: 'tiktok',
    campaign_id: row.dimensions?.campaign_id,
    campaign_name: row.metrics?.campaign_name,
    stat_date: date,
    spend: Number(row.metrics?.spend || 0),
    impressions: Number(row.metrics?.impressions || 0),
    clicks: Number(row.metrics?.clicks || 0),
    ctr: row.metrics?.ctr != null ? Number(row.metrics.ctr) : null,
    cpc: row.metrics?.cpc != null ? Number(row.metrics.cpc) : null,
  }));
}

async function sbUpdateAccountStatus(id, status) {
  await fetch(`${SUPABASE_URL}/rest/v1/ad_accounts?id=eq.${id}`, {
    method: 'PATCH',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ status }),
  });
}

function daysAgoISODate(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function runAdsSync(dateOverride) {
  if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var');
  const date = dateOverride || daysAgoISODate(1);
  const summary = { date, accountsProcessed: 0, rowsUpserted: 0, errors: [] };

  const accounts = await sbGet('ad_accounts?status=eq.connected&select=id,store_id,platform,external_account_id,access_token');
  if (!accounts.length) return { ...summary, message: 'ما في حسابات إعلانات مربوطة بعد' };

  for (const account of accounts) {
    try {
      const rows = account.platform === 'meta'
        ? await syncMetaAccount(account, date)
        : await syncTikTokAccount(account, date);
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

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const q = req.method === 'GET' ? req.query : (req.body || {});
  try {
    const summary = await runAdsSync(q.date);
    res.status(200).json(summary);
  } catch (err) {
    console.error('growth-agent-ads-sync handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
