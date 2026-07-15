const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) return [];
  return r.json();
}

function ymd(d) { return d.toISOString().split('T')[0]; }
function pctChange(today, prev) {
  if (!prev) return today > 0 ? 100 : 0;
  return Math.round(((today - prev) / prev) * 100);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const storeId = req.method === 'GET' ? req.query.storeId : req.body?.storeId;
    if (!storeId) { res.status(400).json({ error: 'Missing storeId' }); return; }

    const now = new Date();
    const today = ymd(now);
    const yesterday = ymd(new Date(now.getTime() - 86400000));
    const weekAgo = ymd(new Date(now.getTime() - 7 * 86400000));

    const [ordersToday, ordersYesterday, ordersWeek, cartsAll, products] = await Promise.all([
      sbGet(`orders?store_id=eq.${storeId}&date=eq.${today}&select=id,amount,status,phone,product_name,items`),
      sbGet(`orders?store_id=eq.${storeId}&date=eq.${yesterday}&select=id,amount,status,phone`),
      sbGet(`orders?store_id=eq.${storeId}&date=gte.${weekAgo}&select=phone,product_name,items,status`),
      sbGet(`abandoned_carts?store_id=eq.${storeId}&select=id,status,created_at`),
      sbGet(`products?store_id=eq.${storeId}&select=id,name_ar,stock`),
    ]);

    const activeToday = ordersToday.filter(o => o.status !== 'cancelled');
    const activeYesterday = ordersYesterday.filter(o => o.status !== 'cancelled');
    const salesToday = activeToday.reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const salesYesterday = activeYesterday.reduce((s, o) => s + (Number(o.amount) || 0), 0);

    // "New" customers today = phones seen today that never ordered before today.
    const phonesToday = [...new Set(activeToday.map(o => o.phone).filter(Boolean))];
    let newCustomersToday = phonesToday.length;
    if (phonesToday.length > 0) {
      const phoneFilter = phonesToday.map(p => `"${p}"`).join(',');
      const priorOrders = await sbGet(`orders?store_id=eq.${storeId}&date=lt.${today}&phone=in.(${phoneFilter})&select=phone`);
      const priorPhones = new Set(priorOrders.map(o => o.phone));
      newCustomersToday = phonesToday.filter(p => !priorPhones.has(p)).length;
    }

    const cartsToday = cartsAll.filter(c => ymd(new Date(c.created_at)) === today && c.status === 'abandoned').length;
    const cartsYesterday = cartsAll.filter(c => ymd(new Date(c.created_at)) === yesterday && c.status === 'abandoned').length;

    // Smart tip: best-selling product in the last 7 days that's now low on stock.
    const salesCount = {};
    ordersWeek.filter(o => o.status !== 'cancelled').forEach(o => {
      if (o.items && o.items.length) {
        o.items.forEach(it => { salesCount[it.productName || it.name_ar] = (salesCount[it.productName || it.name_ar] || 0) + (it.quantity || it.qty || 1); });
      } else if (o.product_name) {
        salesCount[o.product_name] = (salesCount[o.product_name] || 0) + 1;
      }
    });
    const topSeller = Object.entries(salesCount).sort((a, b) => b[1] - a[1])[0];
    let smartTip = null;
    if (topSeller) {
      const prod = products.find(p => p.name_ar === topSeller[0]);
      if (prod && Number(prod.stock) <= 5) {
        smartTip = { type: 'low_stock_bestseller', productName: prod.name_ar, stock: Number(prod.stock), soldLast7d: topSeller[1] };
      }
    }
    if (!smartTip) {
      const anyLow = products.find(p => Number(p.stock) <= 2);
      if (anyLow) smartTip = { type: 'low_stock', productName: anyLow.name_ar, stock: Number(anyLow.stock) };
    }

    res.status(200).json({
      orders: { value: activeToday.length, change: pctChange(activeToday.length, activeYesterday.length) },
      sales: { value: salesToday, change: pctChange(salesToday, salesYesterday) },
      newCustomers: { value: newCustomersToday, change: null },
      abandonedCarts: { value: cartsToday, change: pctChange(cartsToday, cartsYesterday) },
      smartTip,
    });
  } catch (err) {
    console.error('store-summary handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
