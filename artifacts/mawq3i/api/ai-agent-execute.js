const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbHeaders = (extra) => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...extra });

const ALLOWED_PRODUCT_FIELDS = ['name_ar', 'name_en', 'desc_ar', 'desc_en', 'price'];
const ALLOWED_PROMO_FIELDS = ['title_ar', 'subtitle_ar', 'discount_text', 'badge_color', 'text_color', 'expires_at', 'is_active'];

function pick(obj, allowed) {
  const out = {};
  for (const k of allowed) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { storeId, type, params } = req.body || {};
    if (!storeId || !type || !params) { res.status(400).json({ error: 'Missing storeId, type, or params' }); return; }

    if (type === 'update_product') {
      const { product_id } = params;
      if (!product_id) { res.status(400).json({ error: 'Missing product_id' }); return; }
      const body = pick(params, ALLOWED_PRODUCT_FIELDS);
      if (Object.keys(body).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
      const r = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${product_id}&store_id=eq.${storeId}`, {
        method: 'PATCH', headers: sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(body),
      });
      if (!r.ok) { res.status(502).json({ error: await r.text() }); return; }
      const rows = await r.json();
      res.status(200).json({ success: true, result: rows[0] || null });
      return;
    }

    if (type === 'create_promotion') {
      const body = { ...pick(params, ALLOWED_PROMO_FIELDS), store_id: storeId, is_active: true };
      if (!body.title_ar) { res.status(400).json({ error: 'Missing title_ar' }); return; }
      const r = await fetch(`${SUPABASE_URL}/rest/v1/promotions`, {
        method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(body),
      });
      if (!r.ok) { res.status(502).json({ error: await r.text() }); return; }
      const rows = await r.json();
      res.status(200).json({ success: true, result: rows[0] || null });
      return;
    }

    if (type === 'update_promotion') {
      const { promotion_id } = params;
      if (!promotion_id) { res.status(400).json({ error: 'Missing promotion_id' }); return; }
      const body = pick(params, ALLOWED_PROMO_FIELDS);
      if (Object.keys(body).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
      const r = await fetch(`${SUPABASE_URL}/rest/v1/promotions?id=eq.${promotion_id}&store_id=eq.${storeId}`, {
        method: 'PATCH', headers: sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(body),
      });
      if (!r.ok) { res.status(502).json({ error: await r.text() }); return; }
      const rows = await r.json();
      res.status(200).json({ success: true, result: rows[0] || null });
      return;
    }

    res.status(400).json({ error: 'Unknown action type' });
  } catch (err) {
    console.error('ai-agent-execute handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
