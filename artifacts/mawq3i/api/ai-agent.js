const OPENAI_MODEL = 'gpt-4.1-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';

const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!r.ok) throw new Error(`Supabase GET failed: ${r.status}`);
  return r.json();
}

// ─── Tool schema (OpenAI function calling) ───
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_low_stock_products',
      description: 'Get products with low or zero stock for this store, to flag restocking needs.',
      parameters: {
        type: 'object',
        properties: { threshold: { type: 'number', description: 'Stock count at or below which a product is considered low. Default 5.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search this store\'s products by name (Arabic or English), to find a product the merchant is referring to (e.g. before editing it).',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search text, part of the product name.' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_orders',
      description: 'Get the most recent orders for this store, optionally filtered by status.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'How many orders to return. Default 10.' },
          status: { type: 'string', enum: ['new', 'processing', 'delivered', 'cancelled'], description: 'Optional status filter.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sales_stats',
      description: 'Get aggregate sales stats (order count, revenue, cancelled count, top-selling product) for the last N days.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', description: 'How many days back to aggregate. Default 30.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_promotions',
      description: 'List this store\'s current promotion banners (active and inactive), with their IDs — needed before editing an existing banner.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_product',
      description: 'Propose an update to a product (name, description, or price). This does NOT execute immediately — it is shown to the merchant as a confirmation card first. Always call search_products first if you do not already know the exact product_id.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string' },
          name_ar: { type: 'string' },
          name_en: { type: 'string' },
          desc_ar: { type: 'string' },
          desc_en: { type: 'string' },
          price: { type: 'number' },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_promotion',
      description: 'Propose creating a new promotion banner shown above products on the storefront. Does NOT execute immediately — shown to the merchant as a confirmation card first.',
      parameters: {
        type: 'object',
        properties: {
          title_ar: { type: 'string', description: 'Main banner headline, e.g. "تخفيضات نهاية الموسم".' },
          subtitle_ar: { type: 'string' },
          discount_text: { type: 'string', description: 'e.g. "خصم 20%".' },
          badge_color: { type: 'string', description: 'Hex background color, e.g. #C21F1F.' },
          text_color: { type: 'string', description: 'Hex text color, e.g. #FFFFFF.' },
          expires_at: { type: 'string', description: 'ISO date the promo ends, optional.' },
        },
        required: ['title_ar'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_promotion',
      description: 'Propose editing an existing promotion banner (title, colors, text, active state). Does NOT execute immediately. Call get_promotions first to find the promotion_id.',
      parameters: {
        type: 'object',
        properties: {
          promotion_id: { type: 'string' },
          title_ar: { type: 'string' },
          subtitle_ar: { type: 'string' },
          discount_text: { type: 'string' },
          badge_color: { type: 'string' },
          text_color: { type: 'string' },
          expires_at: { type: 'string' },
          is_active: { type: 'boolean' },
        },
        required: ['promotion_id'],
      },
    },
  },
];

const WRITE_TOOLS = new Set(['update_product', 'create_promotion', 'update_promotion']);

async function execReadTool(name, args, storeId) {
  if (name === 'get_low_stock_products') {
    const threshold = args.threshold || 5;
    const rows = await sbGet(`products?store_id=eq.${storeId}&stock=lte.${threshold}&select=id,name_ar,stock,price&order=stock.asc&limit=20`);
    return rows;
  }
  if (name === 'search_products') {
    const q = encodeURIComponent(`%${args.query}%`);
    const rows = await sbGet(`products?store_id=eq.${storeId}&name_ar=ilike.${q}&select=id,name_ar,name_en,desc_ar,price,stock&limit=10`);
    return rows;
  }
  if (name === 'get_recent_orders') {
    const limit = args.limit || 10;
    let path = `orders?store_id=eq.${storeId}&select=id,customer_name,amount,status,date&order=date.desc&limit=${limit}`;
    if (args.status) path += `&status=eq.${args.status}`;
    const rows = await sbGet(path);
    return rows;
  }
  if (name === 'get_sales_stats') {
    const days = args.days || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const rows = await sbGet(`orders?store_id=eq.${storeId}&date=gte.${since}&select=amount,status,product_name`);
    const active = rows.filter(r => r.status !== 'cancelled');
    const revenue = active.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const counts = {};
    active.forEach(r => { if (r.product_name) counts[r.product_name] = (counts[r.product_name] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return {
      period_days: days,
      order_count: rows.length,
      cancelled_count: rows.filter(r => r.status === 'cancelled').length,
      revenue,
      top_product: top ? { name: top[0], count: top[1] } : null,
    };
  }
  if (name === 'get_promotions') {
    const rows = await sbGet(`promotions?store_id=eq.${storeId}&select=id,title_ar,subtitle_ar,discount_text,badge_color,text_color,is_active,expires_at&order=created_at.desc`);
    return rows;
  }
  return { error: 'unknown tool' };
}

function buildSystemPrompt(storeName, isAr) {
  if (isAr) {
    return `أنت "مستشار موقعي الذكي" — مساعد يدير متجر إلكتروني اسمه "${storeName}" على منصة Mawq3i عبر محادثة طبيعية، بدل ما يحتاج صاحب المتجر يتنقل بين صفحات لوحة التحكم.

قدراتك:
- تقدر تستعلم عن بيانات حقيقية وحية (منتجات، مخزون، طلبات، مبيعات، بنرات العروض) عبر الأدوات المتاحة لك — استخدمها دائماً بدل ما تخمّن أو تعتمد على معلومات قديمة.
- تقدر تقترح **وتنفذ فعلياً** تعديلات (تعديل منتج، إنشاء بنر عرض، تعديل بنر موجود) — بس التنفيذ الفعلي يصير بعد موافقة صاحب المتجر، مو أنت.
- إذا صاحب المتجر طلب تعديل شي بدون ما يحدد تفاصيل كافية (مثلاً "خفض السعر" بدون رقم)، اقترح قيمة معقولة بناءً على السياق واذكرها بوضوح، بدل ما تسأل أسئلة كثيرة.
- إذا الطلب يحتاج تعديل منتج أو بنر، ولسا ما تعرف الـ ID، استخدم أداة البحث (search_products أو get_promotions) أول.

أسلوبك:
- عربي بسيط ومباشر، بدون فقرات طويلة.
- لما تعرض بيانات (منتجات، طلبات)، اذكر ملخص قصير بس — التفاصيل الكاملة بتنعرض تلقائياً كبطاقة بالواجهة، فما داعي تكررها بالنص بالتفصيل.
- لما تقترح تعديل (منتج أو بنر)، نفّذ نداء الأداة المناسبة مباشرة، وخلي ردك النصي جملة قصيرة توضح شو اقترحته وليش.`;
  }
  return `You are "Mawq3i AI Advisor" — an assistant that runs an e-commerce store called "${storeName}" on the Mawq3i platform through natural conversation, instead of the merchant navigating dashboard pages.

You can query live store data via tools (products, stock, orders, sales, promo banners) — always use tools instead of guessing. You can also propose product edits and promo banner create/edit actions — but they only execute after the merchant confirms, not you. If the merchant's request is missing a detail (e.g. "lower the price" without a number), propose a reasonable value based on context instead of asking many questions. Keep replies short and direct; when you show data, don't repeat it verbatim since it renders as a card in the UI.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'AI advisor is not configured (missing OPENAI_API_KEY)' });
    return;
  }

  try {
    const { storeId, storeName, messages, language } = req.body || {};
    if (!storeId || !storeName || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing storeId, storeName, or messages' });
      return;
    }

    const isAr = language !== 'en';
    const systemPrompt = buildSystemPrompt(storeName, isAr);
    const recentMessages = messages.slice(-16);

    let chatMessages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content })),
    ];

    let dataCards = [];
    let pendingAction = null;
    let finalReply = '';

    for (let iter = 0; iter < 4; iter++) {
      const openaiRes = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: chatMessages,
          tools: TOOLS,
          temperature: 0.4,
          max_tokens: 700,
        }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        console.error('OpenAI API error:', openaiRes.status, errText);
        res.status(502).json({ error: 'AI provider error', detail: errText.slice(0, 500) });
        return;
      }

      const data = await openaiRes.json();
      const msg = data?.choices?.[0]?.message;
      if (!msg) { res.status(502).json({ error: 'Empty AI response' }); return; }

      const toolCalls = msg.tool_calls || [];

      if (toolCalls.length === 0) {
        finalReply = msg.content || '';
        break;
      }

      // If a write tool was called, stop the loop and surface it as a pending action.
      const writeCall = toolCalls.find(tc => WRITE_TOOLS.has(tc.function.name));
      if (writeCall) {
        let args = {};
        try { args = JSON.parse(writeCall.function.arguments || '{}'); } catch { /* ignore */ }
        pendingAction = { type: writeCall.function.name, params: args };
        finalReply = isAr
          ? 'جاهز — بس بدي تأكيدك قبل ما أنفّذها فعلياً:'
          : "Ready — I just need your confirmation before I make this real:";
        break;
      }

      // Otherwise execute read tools and continue the loop.
      chatMessages.push({ role: 'assistant', content: msg.content || null, tool_calls: toolCalls });
      for (const tc of toolCalls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
        let result;
        try {
          result = await execReadTool(tc.function.name, args, storeId);
        } catch (e) {
          result = { error: String(e) };
        }
        if (Array.isArray(result) && result.length > 0) {
          dataCards.push({ tool: tc.function.name, items: result });
        } else if (result && typeof result === 'object' && !Array.isArray(result) && !result.error) {
          dataCards.push({ tool: tc.function.name, stats: result });
        }
        chatMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }

    res.status(200).json({ reply: finalReply, dataCards, pendingAction });
  } catch (err) {
    console.error('ai-agent handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
