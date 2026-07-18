const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOGO_BASE_URL = process.env.TOGO_API_BASE_URL || 'https://api.togo.ps';
const SB_HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const SB_HEADERS_JSON = { ...SB_HEADERS, 'Content-Type': 'application/json' };

async function getStore(storeId, select) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${storeId}&select=${select}`, { headers: SB_HEADERS });
  const data = await res.json();
  return data && data[0];
}

// ─── create-delivery ────────────────────────────────────────────────
async function handleCreateDelivery(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { storeId, orderId } = req.body || {};
  if (!storeId || !orderId) return res.status(400).json({ success: false, message: 'Missing storeId or orderId' });

  try {
    const [storeRes, orderRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${storeId}&select=togo_api_key,togo_merchant_address_id,name`, { headers: SB_HEADERS }),
      fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=*`, { headers: SB_HEADERS }),
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

    const areaSearch = new URLSearchParams({ city_name_ar: order.city || '' });
    const areaRes = await fetch(`${TOGO_BASE_URL}/api/v1/addresses?${areaSearch.toString()}`, { headers: togoHeaders });
    const areaData = await areaRes.json();
    console.log('[togo debug] area lookup', { city: order.city, status: areaRes.status, body: JSON.stringify(areaData).slice(0, 800) });
    const area = areaData && areaData.data && areaData.data.items && areaData.data.items[0];
    if (!area) {
      return res.status(400).json({ success: false, message: `Could not match city "${order.city}" to a Togo delivery area. Please pick the area manually.` });
    }

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
    console.log('[togo debug] receiver create', { status: receiverRes.status, body: JSON.stringify(receiverData).slice(0, 800) });
    if (!receiverRes.ok || !receiverData.success) {
      return res.status(502).json({ success: false, message: 'Failed to register receiver with Togo', details: receiverData });
    }

    const isCod = order.payment_method !== 'card';
    const deliveryData = {
      value: isCod ? Number(order.amount) : 0,
      type: isCod ? 'COD' : 'NCD',
      merchant_address_id: store.togo_merchant_address_id,
      receiver_address_id: String(receiverData.data.id),
      package_size: 1,
    };
    // Togo's API rejects notes:"" as invalid ("notes is not allowed to be
    // empty") even though the field is documented as optional — only
    // include it when there's real content.
    if (order.notes) deliveryData.notes = order.notes;

    const actionRes = await fetch(`${TOGO_BASE_URL}/api/v1/actions`, {
      method: 'POST',
      headers: togoHeaders,
      body: JSON.stringify({
        event: 'Create_No_Visa',
        data: deliveryData,
      }),
    });
    const actionData = await actionRes.json();
    console.log('[togo debug] action create', { status: actionRes.status, body: JSON.stringify(actionData).slice(0, 800) });
    if (!actionRes.ok || !actionData.success) {
      return res.status(502).json({ success: false, message: 'Failed to create delivery order with Togo', details: actionData });
    }

    const togoDeliveryOrderId = String(actionData.data.id);

    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { ...SB_HEADERS_JSON, Prefer: 'return=minimal' },
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

// ─── delivery-bids ──────────────────────────────────────────────────
async function handleDeliveryBids(req, res) {
  if (req.method === 'GET') {
    const { storeId, togoDeliveryOrderId } = req.query || {};
    if (!storeId || !togoDeliveryOrderId) {
      return res.status(400).json({ success: false, message: 'Missing storeId or togoDeliveryOrderId' });
    }
    const store = await getStore(storeId, 'togo_api_key');
    const apiKey = store && store.togo_api_key;
    if (!apiKey) return res.status(400).json({ success: false, message: 'Store has no Togo API key configured' });

    const togoRes = await fetch(`${TOGO_BASE_URL}/api/v1/bids?order_id=${encodeURIComponent(togoDeliveryOrderId)}`, {
      headers: { 'x-api-key': apiKey },
    });
    const togoData = await togoRes.json();
    return res.status(togoRes.status).json(togoData);
  }

  if (req.method === 'POST') {
    const { storeId, orderId, togoDeliveryOrderId, bidId, courierName, price } = req.body || {};
    if (!storeId || !orderId || !togoDeliveryOrderId || !bidId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const store = await getStore(storeId, 'togo_api_key');
    const apiKey = store && store.togo_api_key;
    if (!apiKey) return res.status(400).json({ success: false, message: 'Store has no Togo API key configured' });

    try {
      const assignRes = await fetch(`${TOGO_BASE_URL}/api/v1/actions`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'Assign', orderId: togoDeliveryOrderId, data: { bid_id: bidId } }),
      });
      const assignData = await assignRes.json();
      if (!assignRes.ok || !assignData.success) {
        return res.status(502).json({ success: false, message: 'Failed to assign delivery company', details: assignData });
      }

      await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
        method: 'PATCH',
        headers: { ...SB_HEADERS_JSON, Prefer: 'return=minimal' },
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

// ─── cancel-delivery ────────────────────────────────────────────────
async function handleCancelDelivery(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { storeId, orderId, togoDeliveryOrderId } = req.body || {};
  if (!storeId || !orderId || !togoDeliveryOrderId) {
    return res.status(400).json({ success: false, message: 'Missing storeId, orderId, or togoDeliveryOrderId' });
  }

  const store = await getStore(storeId, 'togo_api_key');
  const apiKey = store && store.togo_api_key;
  if (!apiKey) return res.status(400).json({ success: false, message: 'Store has no Togo API key configured' });

  try {
    const cancelRes = await fetch(`${TOGO_BASE_URL}/api/v1/actions`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'Cancel', orderId: togoDeliveryOrderId }),
    });
    const cancelData = await cancelRes.json();
    if (!cancelRes.ok || !cancelData.success) {
      return res.status(502).json({ success: false, message: 'Failed to cancel delivery with Togo', details: cancelData });
    }

    // Reset the order's delivery fields so the merchant can request delivery again or arrange it themselves
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { ...SB_HEADERS_JSON, Prefer: 'return=minimal' },
      body: JSON.stringify({
        delivery_provider: 'self',
        togo_delivery_order_id: null,
        togo_delivery_hashed_id: null,
        togo_delivery_status: null,
        togo_bid_id: null,
        togo_courier_name: null,
        togo_delivery_price: null,
      }),
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Unexpected error', error: String(e) });
  }
}

// ─── merchant-address ───────────────────────────────────────────────
async function handleMerchantAddress(req, res) {
  const { action } = req.query || {};

  if (req.method === 'GET' && action === 'areas') {
    const { storeId, search } = req.query;
    if (!storeId) return res.status(400).json({ success: false, message: 'Missing storeId' });
    const store = await getStore(storeId, 'togo_api_key,name');
    if (!store || !store.togo_api_key) return res.status(400).json({ success: false, message: 'Store has no Togo API key configured' });

    const params = new URLSearchParams();
    if (search) params.set('city_name_ar', search);
    const togoRes = await fetch(`${TOGO_BASE_URL}/api/v1/addresses?${params.toString()}`, {
      headers: { 'x-api-key': store.togo_api_key },
    });
    const togoData = await togoRes.json();
    return res.status(togoRes.status).json(togoData);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { storeId, title, senderName, senderPhone, areaId, details } = req.body || {};
  if (!storeId || !senderName || !senderPhone || !areaId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const store = await getStore(storeId, 'togo_api_key,name');
    if (!store || !store.togo_api_key) {
      return res.status(400).json({ success: false, message: 'Store has no Togo API key configured yet' });
    }

    const togoRes = await fetch(`${TOGO_BASE_URL}/api/v1/merchants/addresses`, {
      method: 'POST',
      headers: { 'x-api-key': store.togo_api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || 'Main Branch',
        sender_name: senderName,
        sender_phone_number: senderPhone,
        area_id: areaId,
        details: details || '',
        is_default: true,
      }),
    });
    const togoData = await togoRes.json();
    if (!togoRes.ok || !togoData.success) {
      return res.status(502).json({ success: false, message: 'Failed to register pickup address with Togo', details: togoData });
    }

    const merchantAddressId = togoData.data.id;
    await fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${storeId}`, {
      method: 'PATCH',
      headers: { ...SB_HEADERS_JSON, Prefer: 'return=minimal' },
      body: JSON.stringify({
        togo_merchant_address_id: String(merchantAddressId),
        togo_pickup_area_id: areaId,
        togo_pickup_details: details || '',
        togo_pickup_sender_name: senderName,
        togo_pickup_sender_phone: senderPhone,
        togo_delivery_enabled: true,
      }),
    });

    return res.status(200).json({ success: true, merchantAddressId });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Unexpected error', error: String(e) });
  }
}

export default async function handler(req, res) {
  if (!SUPABASE_KEY) {
    res.status(500).json({ success: false, message: 'togo endpoint is not configured (missing SUPABASE_SERVICE_ROLE_KEY)' });
    return;
  }
  const resource = (req.query && req.query.resource) || (req.body && req.body.resource);
  if (resource === 'create-delivery') return handleCreateDelivery(req, res);
  if (resource === 'delivery-bids') return handleDeliveryBids(req, res);
  if (resource === 'cancel-delivery') return handleCancelDelivery(req, res);
  if (resource === 'merchant-address') return handleMerchantAddress(req, res);
  return res.status(400).json({ success: false, message: 'Missing or invalid resource (expected create-delivery, delivery-bids, cancel-delivery, or merchant-address)' });
}
