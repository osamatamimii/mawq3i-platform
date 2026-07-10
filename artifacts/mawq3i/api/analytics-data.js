import crypto from 'crypto';

// GA4 property IDs (fixed — one for the platform dashboard, one shared by all merchant storefronts)
const GA_PROPERTY_PLATFORM = '545007188';   // mawq3i.co — G-N41DTN4060
const GA_PROPERTY_STOREFRONTS = '545020889'; // shared by all client stores — G-K8F17WB4Q0

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

    // Top pages (storefront scope only — useful to know which products get visited)
    let topPages = [];
    if (scope === 'storefront') {
      const pagesReport = await runReport(propertyId, {
        days, hostname,
        metrics: ['screenPageViews'],
        dimensions: ['pagePath'],
      });
      topPages = flattenReport(pagesReport)
        .sort((a, b) => b.screenPageViews - a.screenPageViews)
        .slice(0, 5);
    }

    res.status(200).json({
      configured: true,
      scope,
      days,
      activeUsers: Math.round(totals.activeUsers || 0),
      sessions: Math.round(totals.sessions || 0),
      pageViews: Math.round(totals.screenPageViews || 0),
      avgSessionSeconds: Math.round(totals.averageSessionDuration || 0),
      topPages,
    });
  } catch (err) {
    console.error('analytics-data handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
