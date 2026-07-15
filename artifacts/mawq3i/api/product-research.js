const OPENAI_MODEL = 'gpt-4.1-mini';
const OPENAI_URL = 'https://api.openai.com/v1/responses';
const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';

const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

async function logUsageEvent(storeId, featureKey) {
  if (!storeId) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/feature_usage_events`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ store_id: storeId, event_type: 'ai_tool', feature_key: featureKey }),
    });
  } catch (e) {
    console.error('logUsageEvent failed:', e);
  }
}

async function getStoreCategories(storeId) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?store_id=eq.${storeId}&select=category&limit=50`, { headers: sbHeaders });
    if (!r.ok) return [];
    const rows = await r.json();
    return [...new Set(rows.map(p => p.category).filter(Boolean))];
  } catch {
    return [];
  }
}

function extractOutputText(data) {
  const msg = (data.output || []).find(o => o.type === 'message');
  if (!msg) return { text: '', citations: [] };
  const part = (msg.content || []).find(c => c.type === 'output_text');
  if (!part) return { text: '', citations: [] };
  const citations = (part.annotations || [])
    .filter(a => a.type === 'url_citation')
    .map(a => ({ title: a.title, url: a.url }));
  return { text: part.text || '', citations };
}

function parseJsonLoose(text, kind) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const re = kind === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
    const match = cleaned.match(re);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* ignore */ }
    }
    return null;
  }
}

async function callOpenAI(apiKey, prompt) {
  const openaiRes = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      tools: [{ type: 'web_search' }],
      input: prompt,
    }),
  });
  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    console.error('OpenAI product-research error:', openaiRes.status, errText);
    const err = new Error('AI provider error');
    err.detail = errText.slice(0, 500);
    err.status = 502;
    throw err;
  }
  return openaiRes.json();
}

async function handleWinningProducts(apiKey, body) {
  const { storeId, niche, market, language } = body;
  if (!storeId) { const e = new Error('Missing storeId'); e.status = 400; throw e; }

  const isAr = language !== 'en';
  let resolvedNiche = (niche || '').trim();
  if (!resolvedNiche) {
    const cats = await getStoreCategories(storeId);
    resolvedNiche = cats.slice(0, 5).join('، ') || (isAr ? 'منتجات عامة للتجارة الإلكترونية' : 'general e-commerce products');
  }
  const resolvedMarket = (market || '').trim() || (isAr ? 'فلسطين والأردن والخليج' : 'Palestine, Jordan and the Gulf');

  const prompt = isAr
    ? `أنت باحث تجارة إلكترونية. ابحث الآن على الويب (AliExpress Trending, TikTok Shop, Google Trends, مواقع تتبع منتجات الدروبشيبينج الرابحة) عن أحدث المنتجات الرابحة (winning products) في مجال "${resolvedNiche}" وتناسب بيعها لسوق ${resolvedMarket}.

أرجع النتيجة **JSON فقط** بدون أي نص إضافي، بالشكل التالي بالضبط (مصفوفة من 5 إلى 6 عناصر):
[
  {
    "name_ar": "اسم المنتج بالعربي",
    "name_en": "Product name in English",
    "why_trending": "سبب موجز (سطرين كحد أقصى) ليش المنتج رائج الآن، بالاستناد لنتائج البحث الفعلية",
    "target_audience": "الفئة المستهدفة",
    "price_range": "نطاق سعر مقترح للبيع، مثال: 40-70 ₪",
    "source_hint": "اسم مصدر واحد على الأقل استندت عليه (مثال: AliExpress Trending, TikTok Shop, Google Trends)"
  }
]

لا تخترع منتجات بدون استناد لنتائج بحث حقيقية، وركز على منتجات فعلاً قابلة للشراء والشحن لسوق ${resolvedMarket}.`
    : `You are an e-commerce research analyst. Search the web now (AliExpress Trending, TikTok Shop, Google Trends, dropshipping winning-product trackers) for current winning products in the "${resolvedNiche}" niche, suitable for selling in ${resolvedMarket}.

Return **JSON only**, no extra text, in exactly this shape (array of 5-6 items):
[
  {
    "name_ar": "Arabic product name",
    "name_en": "Product name in English",
    "why_trending": "Brief (max 2 sentences) reason it's trending now, grounded in actual search results",
    "target_audience": "Target audience",
    "price_range": "Suggested resale price range, e.g. 40-70 ILS",
    "source_hint": "At least one source you relied on (e.g. AliExpress Trending, TikTok Shop, Google Trends)"
  }
]

Do not invent products without grounding in real search results; focus on products actually purchasable/shippable to ${resolvedMarket}.`;

  const data = await callOpenAI(apiKey, prompt);
  const { text, citations } = extractOutputText(data);
  const products = parseJsonLoose(text, 'array');
  if (!products) { const e = new Error('Could not parse AI response'); e.status = 502; e.raw = text.slice(0, 500); throw e; }

  await logUsageEvent(storeId, 'winning_products');
  return { niche: resolvedNiche, market: resolvedMarket, products, citations };
}

async function handleCompetitorPrices(apiKey, body) {
  const { storeId, productName, myPrice, currency, market, language } = body;
  if (!storeId || !productName) { const e = new Error('Missing storeId or productName'); e.status = 400; throw e; }

  const isAr = language !== 'en';
  const resolvedMarket = (market || '').trim() || (isAr ? 'فلسطين والأردن والخليج' : 'Palestine, Jordan and the Gulf');
  const resolvedCurrency = currency || 'ILS';
  const myPriceLine = myPrice
    ? (isAr ? `سعري الحالي لهذا المنتج هو ${myPrice} ${resolvedCurrency}.` : `My current price for this product is ${myPrice} ${resolvedCurrency}.`)
    : '';

  const prompt = isAr
    ? `أنت باحث أسعار تجارة إلكترونية. ابحث الآن على الويب عن سعر المنتج التالي عند منافسين ومتاجر أونلاين (AliExpress, Amazon, Noon, Jumia, مواقع ومتاجر محلية فلسطينية/أردنية/خليجية، إنستغرام شوبس) بما يناسب سوق ${resolvedMarket}:

المنتج: "${productName}"
${myPriceLine}

أرجع النتيجة **JSON فقط** بدون أي نص إضافي، بالشكل التالي بالضبط:
{
  "competitors": [
    { "store_name": "اسم المتجر/المنصة", "price": 00, "currency": "${resolvedCurrency}", "url": "رابط المصدر إن وجد", "note": "ملاحظة قصيرة (مثال: شحن مجاني، جودة أقل، نفس الموديل)" }
  ],
  "summary_ar": "ملخص قصير (2-3 جمل) يقارن موقعي التسعيري مقابل المنافسين ويقترح توصية عملية"
}

استند فقط على نتائج بحث حقيقية، ولا تخترع أسعار أو متاجر غير موجودة. إذا ما لقيت نتائج كافية، أرجع مصفوفة أقصر بس بدون اختلاق بيانات.`
    : `You are an e-commerce pricing researcher. Search the web now for the price of the following product at competitors and online marketplaces (AliExpress, Amazon, Noon, Jumia, local Palestinian/Jordanian/Gulf stores, Instagram shops) relevant to the ${resolvedMarket} market:

Product: "${productName}"
${myPriceLine}

Return **JSON only**, no extra text, in exactly this shape:
{
  "competitors": [
    { "store_name": "Store/platform name", "price": 00, "currency": "${resolvedCurrency}", "url": "source URL if available", "note": "short note (e.g. free shipping, lower quality, same model)" }
  ],
  "summary_ar": "A short 2-3 sentence summary (in Arabic) comparing my pricing to competitors with a practical recommendation"
}

Rely only on real search results; do not invent prices or stores. If you cannot find enough results, return a shorter array rather than fabricating data.`;

  const data = await callOpenAI(apiKey, prompt);
  const { text, citations } = extractOutputText(data);
  const parsed = parseJsonLoose(text, 'object');
  if (!parsed) { const e = new Error('Could not parse AI response'); e.status = 502; e.raw = text.slice(0, 500); throw e; }

  await logUsageEvent(storeId, 'competitor_prices');
  return { productName, competitors: parsed.competitors || [], summary: parsed.summary_ar || '', citations };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Product research is not configured (missing OPENAI_API_KEY)' });
    return;
  }

  const body = req.body || {};
  const action = body.action;

  try {
    let result;
    if (action === 'winning_products') {
      result = await handleWinningProducts(apiKey, body);
    } else if (action === 'competitor_prices') {
      result = await handleCompetitorPrices(apiKey, body);
    } else {
      res.status(400).json({ error: 'Invalid or missing action (expected "winning_products" or "competitor_prices")' });
      return;
    }
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    const payload = { error: err.message || 'Internal server error' };
    if (err.detail) payload.detail = err.detail;
    if (err.raw) payload.raw = err.raw;
    if (status >= 500) console.error('product-research handler error:', err);
    res.status(status).json(payload);
  }
}
