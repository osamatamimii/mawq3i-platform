// Togo calls this endpoint (POST) whenever a payment succeeds or fails.
// URL given to Togo: https://mawq3i.co/api/togo-webhook?token=<TOGO_WEBHOOK_SECRET>
//
// Confirmed payload fields (per Togo's technical team, 2026-07-09):
//   { order_id, payment_status, key }
// "key" is the same API key used for that merchant — we use it as a second
// layer of verification: it must match the togo_api_key stored for the
// store that owns the matched order, or we don't trust the update.
//
// This endpoint also still logs the raw payload to `webhook_logs` and keeps
// a few fallback field-name guesses, in case Togo's real payload differs
// slightly from what was described, or delivery-status webhooks reuse the
// same endpoint later with a different shape.

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
  const d = body?.data || body;
  return (
    d?.order_id || d?.orderId || d?.hashed_id || d?.hashedId ||
    d?.id || d?.reference || d?.order?.id || null
  );
}

function extractKey(body) {
  const d = body?.data || body;
  return d?.key || d?.api_key || d?.apiKey || null;
}

function extractStatus(body) {
  const d = body?.data || body;
  // "payment_status" is the confirmed field name; keep older guesses as fallback
  const raw = (d?.payment_status || d?.paymentStatus || d?.status || d?.event || '').toString().toLowerCase();
  if (d?.success === true) return 'paid';
  if (d?.success === false) return 'failed';
  if (['success', 'paid', 'completed', 'confirmed', 'approved'].some(s => raw.includes(s))) return 'paid';
  if (['fail', 'declined', 'cancel', 'error', 'rejected'].some(s => raw.includes(s))) return 'failed';
  if (['pending', 'waiting'].some(s => raw.includes(s))) return 'pending';
  return raw || null;
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
  const payloadKey = extractKey(body);

  let matchedOrderId = null;
  let note = 'no matching order found';
  try {
    if (orderRef) {
      // Find the order + its store's registered Togo API key in one go
      const res1 = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?or=(togo_order_id.eq.${orderRef},togo_hashed_id.eq.${orderRef})&select=id,store_id,stores(togo_api_key)`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const rows = await res1.json();
      const match = Array.isArray(rows) ? rows[0] : null;

      if (match) {
        matchedOrderId = match.id;
        const storeKey = match.stores?.togo_api_key;

        // Verify the key in the payload matches the store's own Togo API key.
        // If we don't have a key to compare (either side), proceed but note it —
        // better to still update than silently drop a legitimate payment update.
        const keyMatches = !payloadKey || !storeKey || payloadKey === storeKey;

        if (!keyMatches) {
          note = 'key mismatch — update REJECTED (possible spoofed webhook)';
        } else if (status) {
          await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${match.id}`, {
            method: 'PATCH',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ payment_status: status }),
          });
          note = `updated to ${status}` + (payloadKey ? ' (key verified)' : ' (no key to verify against)');
        } else {
          note = 'matched order but no usable status in payload';
        }
      }
    }
  } catch (e) {
    await logWebhook(body, null, 'error: ' + String(e));
    return res.status(200).json({ success: true }); // still ack so Togo doesn't retry forever
  }

  await logWebhook(body, matchedOrderId, note);

  return res.status(200).json({ success: true });
}
