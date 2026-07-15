import crypto from 'crypto';

// GA4 property IDs (fixed — one for the platform dashboard, one shared by all merchant storefronts)
const GA_PROPERTY_PLATFORM = '545007188';   // mawq3i.co — G-N41DTN4060
const GA_PROPERTY_STOREFRONTS = '545020889'; // shared by all client stores — G-K8F17WB4Q0

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fetchProductNames(ids) {
  if (!ids.length) return {};
  const filter = ids.map(id => `"${id}"`).join(',');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?id=in.(${filter})&select=id,name_ar,name_en`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return {};
  const rows = await r.json();
  const map = {};
  rows.forEach(p => { map[p.id] = p.name_ar || p.name_en || p.id; });
  return map;
}

let cachedToken = null; // { accessToken, expiresAt } — reused across warm invocations

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) {
    return cachedToken.accessToken;
  }

  const raw = process.env.GA_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing GA_SERVICE_ACCOUNT_KEY env var');
  let key;
  try {
    key = JSON.parse(raw);
  } catch (e) {
    // Safe to expose: the JSON boilerplate at the start/end of any GCP key file
    // carries no secret value. We deliberately avoid the middle (private_key).
    const err = new Error(
      `GA_SERVICE_ACCOUNT_KEY is not valid JSON: ${e.message}. ` +
      `length=${raw.length}, starts="${raw.slice(0, 25)}", ends="${raw.slice(-25)}"`
    );
    throw err;
  }

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
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const data = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

async function runReport(propertyId, { days = 30, hostname = null, metrics, dimensions = [] }) {
  const accessToken = await getAccessToken();
  const body = {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    metrics: metrics.map((name) => ({ name })),
    dimensions: dimensions.map((name) => ({ name })),
  };
  if (hostname) {
    body.dimensionFilter = {
      filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: hostname } },
    };
    if (!dimensions.includes('hostName')) body.dimensions = [...body.dimensions, { name: 'hostName' }];
  }

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GA4 runReport failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function flattenReport(report) {
  const metricNames = (report.metricHeaders || []).map((m) => m.name);
  const dimNames = (report.dimensionHeaders || []).map((d) => d.name);
  const rows = (report.rows || []).map((row) => {
    const out = {};
    (row.dimensionValues || []).forEach((v, i) => { out[dimNames[i]] = v.value; });
    (row.metricValues || []).forEach((v, i) => { out[metricNames[i]] = Number(v.value); });
    return out;
  });
  return rows;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!process.env.GA_SERVICE_ACCOUNT_KEY) {
    res.status(200).json({ configured: false, message: 'Google Analytics service account is not connected yet.' });
    return;
  }

  try {
    const q = req.method === 'GET' ? req.query : (req.body || {});
    const scope = q.scope || 'storefront'; // 'platform' | 'storefront'
    const days = Number(q.days) || 30;
    const hostname = q.hostname || null;

    const propertyId = scope === 'platform' ? GA_PROPERTY_PLATFORM : GA_PROPERTY_STOREFRONTS;

    const report = await runReport(propertyId, {
      days,
      hostname: scope === 'storefront' ? hostname : null,
      metrics: ['activeUsers', 'sessions', 'screenPageViews', 'averageSessionDuration'],
    });

    const totals = flattenReport({ ...report, rows: report.totals || report.rows })[0] || {
      activeUsers: 0, sessions: 0, screenPageViews: 0, averageSessionDuration: 0,
    };

    // Top pages + top products (storefront scope only)
    let topPages = [];
    let topProducts = [];
    if (scope === 'storefront') {
      const pagesReport = await runReport(propertyId, {
        days, hostname,
        metrics: ['screenPageViews'],
        dimensions: ['pagePath'],
      });
      const allPages = flattenReport(pagesReport);
      topPages = [...allPages].sort((a, b) => b.screenPageViews - a.screenPageViews).slice(0, 5);

      // Derive per-product views directly from the URL (?id=<productId>) rather than
      // GA4's item-scoped dimensions, which Google suppresses at low traffic volumes.
      const idCounts = {};
      allPages.forEach(r => {
        const m = (r.pagePath || '').match(/[?&]id=([a-f0-9-]{8,})/i);
        if (m) idCounts[m[1]] = (idCounts[m[1]] || 0) + (r.screenPageViews || 0);
      });
      const ids = Object.keys(idCounts);
      if (ids.length) {
        const names = await fetchProductNames(ids);
        topProducts = ids
          .map(id => ({ itemId: id, itemName: names[id] || id, itemsViewed: idCounts[id] }))
          .sort((a, b) => b.itemsViewed - a.itemsViewed)
          .slice(0, 10);
      }
    }

    // Traffic sources (storefront scope only) — where visitors are coming from
    let trafficSources = [];
    if (scope === 'storefront') {
      try {
        const sourcesReport = await runReport(propertyId, {
          days, hostname,
          metrics: ['sessions'],
          dimensions: ['sessionDefaultChannelGroup'],
        });
        trafficSources = flattenReport(sourcesReport)
          .map(r => ({ source: r.sessionDefaultChannelGroup || 'Direct', sessions: r.sessions || 0 }))
          .sort((a, b) => b.sessions - a.sessions)
          .slice(0, 8);
      } catch (e) {
        console.error('traffic sources report failed:', e?.message);
      }
    }

    res.status(200).json({
      configured: true,
      scope,
      days,
      // visitors: unique people who visited (a person visiting twice still counts once)
      visitors: Math.round(totals.activeUsers || 0),
      // visits: total number of separate visits/sessions (one person can visit multiple times)
      visits: Math.round(totals.sessions || 0),
      // pageViews: total pages opened across all visits (one visit can open several pages)
      pageViews: Math.round(totals.screenPageViews || 0),
      avgSessionSeconds: Math.round(totals.averageSessionDuration || 0),
      topPages,
      topProducts,
      trafficSources,
      // Back-compat aliases for existing frontend code
      activeUsers: Math.round(totals.activeUsers || 0),
      sessions: Math.round(totals.sessions || 0),
    });
  } catch (err) {
    console.error('analytics-data handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
