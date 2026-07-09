const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';
const TOGO_BASE_URL = process.env.TOGO_API_BASE_URL || 'https://api.togo.ps';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { storeId, orderId } = req.body || {};
  if (!storeId || !orderId) {
    return res.status(400).json({ success: false, message: 'Missing storeId or orderId' });
  }

  try {
    const [storeRes, orderRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${storeId}&select=togo_api_key,togo_merchant_address_id,name`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=*`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }),
    ]);
    const store = (await storeRes.json())[0];
    const order = (await orderRes.json())[0];

    if (!store || !store.togo_api_key) {
      return res.status(400).json({ success: false, message: 'Card/delivery is not configured for this store yet' });
    }
    if (!store.togo_merchant_address_id) {
      return res.status(400).json({ success: false, message: 'Pickup address is not set up for this store yet. Set it up in Settings first.' });
    }
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const togoHeaders = { 'x-api-key': store.togo_api_key, 'Content-Type': 'application/json' };

    // Find an area_id matching the customer's city (best-effort lookup)
    const areaSearch = new URLSearchParams({ city_name_ar: order.city || '' });
    const areaRes = await fetch(`${TOGO_BASE_URL}/api/v1/addresses?${areaSearch.toString()}`, { headers: togoHeaders });
    const areaData = await areaRes.json();
    const area = areaData && areaData.data && areaData.data.items && areaData.data.items[0];
    if (!area) {
      return res.status(400).json({ success: false, message: `Could not match city "${order.city}" to a Togo delivery area. Please pick the area manually.` });
    }

    // Create receiver address (delivery-order shape: needs area_id, not free-text city)
    const receiverRes = await fetch(`${TOGO_BASE_URL}/api/v1/receivers-addresses`, {
      method: 'POST',
      headers: togoHeaders,
      body: JSON.stringify({
        receiver_name: order.customer_name,
        receiver_phone_number: order.phone,
        details: order.address || order.notes || `Order ${orderId}`,
        area_id: area.id,
      }),
    });
    const receiverData = await receiverRes.json();
    if (!receiverRes.ok || !receiverData.success) {
      return res.status(502).json({ success: false, message: 'Failed to register receiver with Togo', details: receiverData });
    }

    const isCod = order.payment_method !== 'card';
    const actionRes = await fetch(`${TOGO_BASE_URL}/api/v1/actions`, {
      method: 'POST',
      headers: togoHeaders,
      body: JSON.stringify({
        event: 'Create_No_Visa',
        data: {
          value: isCod ? Number(order.amount) : 0,
          type: isCod ? 'COD' : 'NCD',
          merchant_address_id: store.togo_merchant_address_id,
          receiver_address_id: String(receiverData.data.id),
          package_size: 1,
          notes: order.notes || '',
        },
      }),
    });
    const actionData = await actionRes.json();
    if (!actionRes.ok || !actionData.success) {
      return res.status(502).json({ success: false, message: 'Failed to create delivery order with Togo', details: actionData });
    }

    const togoDeliveryOrderId = String(actionData.data.id);

    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        delivery_provider: 'togo',
        togo_delivery_order_id: togoDeliveryOrderId,
        togo_delivery_hashed_id: actionData.data.hashed_id || null,
        togo_delivery_status: 'awaiting_bids',
      }),
    });

    return res.status(200).json({ success: true, togoDeliveryOrderId });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Unexpected error', error: String(e) });
  }
}
