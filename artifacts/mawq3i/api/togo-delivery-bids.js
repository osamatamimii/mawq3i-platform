const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';
const TOGO_BASE_URL = process.env.TOGO_API_BASE_URL || 'https://api.togo.ps';

async function getStoreKey(storeId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${storeId}&select=togo_api_key`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const data = await res.json();
  return data && data[0] && data[0].togo_api_key;
}

export default async function handler(req, res) {
  // GET ?storeId=...&togoDeliveryOrderId=... -> list bids from competing delivery companies
  if (req.method === 'GET') {
    const { storeId, togoDeliveryOrderId } = req.query || {};
    if (!storeId || !togoDeliveryOrderId) {
      return res.status(400).json({ success: false, message: 'Missing storeId or togoDeliveryOrderId' });
    }
    const apiKey = await getStoreKey(storeId);
    if (!apiKey) return res.status(400).json({ success: false, message: 'Store has no Togo API key configured' });

    const togoRes = await fetch(`${TOGO_BASE_URL}/api/v1/bids?order_id=${encodeURIComponent(togoDeliveryOrderId)}`, {
      headers: { 'x-api-key': apiKey },
    });
    const togoData = await togoRes.json();
    return res.status(togoRes.status).json(togoData);
  }

  // POST -> assign the chosen bid to the delivery order
  if (req.method === 'POST') {
    const { storeId, orderId, togoDeliveryOrderId, bidId, courierName, price } = req.body || {};
    if (!storeId || !orderId || !togoDeliveryOrderId || !bidId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const apiKey = await getStoreKey(storeId);
    if (!apiKey) return res.status(400).json({ success: false, message: 'Store has no Togo API key configured' });

    try {
      const assignRes = await fetch(`${TOGO_BASE_URL}/api/v1/actions`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'Assign',
          orderId: togoDeliveryOrderId,
          data: { bid_id: bidId },
        }),
      });
      const assignData = await assignRes.json();
      if (!assignRes.ok || !assignData.success) {
        return res.status(502).json({ success: false, message: 'Failed to assign delivery company', details: assignData });
      }

      await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          togo_bid_id: String(bidId),
          togo_courier_name: courierName || null,
          togo_delivery_price: price ?? null,
          togo_delivery_status: 'assigned',
          status: 'processing',
        }),
      });

      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Unexpected error', error: String(e) });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
