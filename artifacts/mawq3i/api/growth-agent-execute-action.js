// ============================================================
// Growth Agent — المرحلة 3: تنفيذ/رفض إجراء مقترح من التاجر
// POST body: { event_id, decision: 'approve' | 'reject' }
// Header: Authorization: Bearer <supabase access token>
// ============================================================

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5Nzc4NjksImV4cCI6MjA5MzU1Mzg2OX0.N7iVS_0tBPqfpHAFPw9OxpA2n7JXRWZEbzp3R0ZiNHI';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders(extra = {}) {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

async function getUserFromToken(accessToken) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  return r.json();
}

// نفّذ الأكشن الفعلي حسب action_type المخزّن بـ event.data — قائمة مقفلة ومعروفة، مافي تنفيذ حر
async function executeAction(event) {
  const actionType = event.data?.action_type;
  if (actionType === 'hide_product' && event.related_product_id) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${event.related_product_id}`, {
      method: 'PATCH',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ status: 'hidden' }),
    });
    if (!r.ok) throw new Error(`Failed to hide product: ${r.status} ${await r.text()}`);
    return { executed: true, action_type: actionType };
  }
  // لا يوجد action_type معروف — ما بننفذ شي (أمان: نرفض التنفيذ بدل ما نخمن)
  throw new Error(`Unknown or unsupported action_type: ${actionType}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!SUPABASE_SERVICE_KEY) { res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY env var' }); return; }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { event_id: eventId, decision } = req.body || {};
  if (!token || !eventId || !['approve', 'reject'].includes(decision)) {
    res.status(400).json({ error: 'Missing token, event_id, or invalid decision' });
    return;
  }

  const user = await getUserFromToken(token);
  if (!user?.id) { res.status(401).json({ error: 'Invalid session' }); return; }

  try {
    // اجلب الحدث وتحقق إنه فعلاً تبع متجر هاد المستخدم
    const eventRes = await fetch(`${SUPABASE_URL}/rest/v1/store_growth_events?id=eq.${eventId}&select=*`, { headers: sbHeaders() });
    const [event] = await eventRes.json();
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }

    const storeCheck = await fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${event.store_id}&owner_id=eq.${user.id}&select=id`, { headers: sbHeaders() });
    const stores = await storeCheck.json();
    if (!Array.isArray(stores) || stores.length === 0) { res.status(403).json({ error: 'Not your store' }); return; }

    if (event.status !== 'pending') { res.status(409).json({ error: 'Event already resolved' }); return; }
    if (event.event_type !== 'suggested_action') { res.status(400).json({ error: 'This event does not require a decision' }); return; }

    if (decision === 'reject') {
      await fetch(`${SUPABASE_URL}/rest/v1/store_growth_events?id=eq.${eventId}`, {
        method: 'PATCH',
        headers: sbHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ status: 'rejected', resolved_at: new Date().toISOString() }),
      });
      res.status(200).json({ status: 'rejected' });
      return;
    }

    // decision === 'approve'
    await executeAction(event);
    await fetch(`${SUPABASE_URL}/rest/v1/store_growth_events?id=eq.${eventId}`, {
      method: 'PATCH',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ status: 'approved', resolved_at: new Date().toISOString() }),
    });
    res.status(200).json({ status: 'approved', executed: true });
  } catch (err) {
    console.error('growth-agent-execute-action error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
