// Togo calls this endpoint (POST) whenever a payment succeeds or fails.
// URL to give Togo: https://mawq3i.co/api/togo-webhook?token=<TOGO_WEBHOOK_SECRET>
//
// We don't yet know Togo's exact payload shape, so this endpoint:
//   1. Always logs the raw payload to `webhook_logs` (so we can inspect the
//      first real call and confirm field names)
//   2. Tries several common field-name guesses to find the order reference
//      and success/failure status, and updates the matching order if found
//   3. Always responds 200 quickly so Togo doesn't retry unnecessarily

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';
const WEBHOOK_SECRET = process.env.TOGO_WEBHOOK_SECRET;

async function logWebhook(payload, matchedOrderId, note) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/webhook_logs`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ source: 'togo', payload, matched_order_id: matchedOrderId || null, note: note || null }),
    });
  } catch (e) {
    console.error('Failed to log webhook', e);
  }
}

function extractOrderRef(body) {
  // Try common shapes: {data:{...}}, or flat
  const d = body?.data || body;
  return (
    d?.order_id || d?.orderId || d?.hashed_id || d?.hashedId ||
    d?.id || d?.reference || d?.order?.id || null
  );
}

function extractStatus(body) {
  const d = body?.data || body;
  const raw = (d?.status || d?.payment_status || d?.paymentStatus || d?.event || '').toString().toLowerCase();
  if (d?.success === true) return 'paid';
  if (d?.success === false) return 'failed';
  if (['success', 'paid', 'completed', 'confirmed', 'approved'].some(s => raw.includes(s))) return 'paid';
  if (['fail', 'declined', 'cancel', 'error', 'rejected'].some(s => raw.includes(s))) return 'failed';
  return null;
}

export default async function handler(req, res) {
  if (WEBHOOK_SECRET) {
    const token = req.query?.token;
    if (token !== WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ success: true, message: 'Togo webhook endpoint is alive. Use POST.' });
  }

  const body = req.body || {};
  const orderRef = extractOrderRef(body);
  const status = extractStatus(body);

  let matchedOrderId = null;
  try {
    if (orderRef) {
      // An order could be matched via the payment reference OR the delivery reference
      const res1 = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?or=(togo_order_id.eq.${orderRef},togo_hashed_id.eq.${orderRef})&select=id`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const rows = await res1.json();
      const match = rows && rows[0];
      if (match) {
        matchedOrderId = match.id;
        if (status) {
          await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${match.id}`, {
            method: 'PATCH',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ payment_status: status }),
          });
        }
      }
    }
  } catch (e) {
    await logWebhook(body, null, 'error: ' + String(e));
    return res.status(200).json({ success: true }); // still ack so Togo doesn't retry forever
  }

  await logWebhook(body, matchedOrderId, matchedOrderId ? `updated to ${status}` : 'no matching order found');

  return res.status(200).json({ success: true });
}
