const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';
const TOGO_BASE_URL = process.env.TOGO_API_BASE_URL || 'https://api.togo.ps';

async function getStore(storeId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${storeId}&select=togo_api_key,name`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const data = await res.json();
  return data && data[0];
}

export default async function handler(req, res) {
  const { action } = req.query || {};

  // GET ?action=areas&search=Nablus&storeId=... -> proxy Togo's area list for a picker
  if (req.method === 'GET' && action === 'areas') {
    const { storeId, search } = req.query;
    if (!storeId) return res.status(400).json({ success: false, message: 'Missing storeId' });
    const store = await getStore(storeId);
    if (!store || !store.togo_api_key) return res.status(400).json({ success: false, message: 'Store has no Togo API key configured' });

    const params = new URLSearchParams();
    if (search) {
      params.set('city_name_ar', search);
    }
    const togoRes = await fetch(`${TOGO_BASE_URL}/api/v1/addresses?${params.toString()}`, {
      headers: { 'x-api-key': store.togo_api_key },
    });
    const togoData = await togoRes.json();
    return res.status(togoRes.status).json(togoData);
  }

  // POST -> register (or update) the merchant's pickup address with Togo
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { storeId, title, senderName, senderPhone, areaId, details } = req.body || {};
  if (!storeId || !senderName || !senderPhone || !areaId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const store = await getStore(storeId);
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
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
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
