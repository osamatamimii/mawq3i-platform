const OPENAI_MODEL = 'gpt-4.1-nano';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';

async function logUsageEvent(storeId, featureKey) {
  if (!storeId) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/feature_usage_events`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ store_id: storeId, event_type: 'ai_tool', feature_key: featureKey }),
    });
  } catch (e) {
    console.error('logUsageEvent failed:', e);
  }
}

function buildSystemPrompt(storeName, summary, isAr) {
  if (isAr) {
    return `أنت "مستشار موقعي الذكي" — خبير تسويق ومبيعات متخصص بالمتاجر الإلكترونية الصغيرة والمتوسطة في فلسطين والأردن.
تتحدث مع صاحب متجر اسمه "${storeName}" على منصة موقعي (Mawq3i).

بيانات المتجر الحالية (منتجات، مخزون، طلبات، مبيعات):
${summary}

تعليماتك:
- جاوب بالعربي دائماً (لهجة مفهومة، مش فصحى معقدة)، بشكل مباشر وعملي.
- اعتمد على البيانات الفعلية المرفقة أعلاه، لا تخترع أرقام أو منتجات غير موجودة.
- اقترح أفكار قابلة للتنفيذ فوراً: عروض، خصومات، bundle، توقيت نشر، تحسين وصف منتج، إلخ.
- كن مختصراً ومركّزاً — نقاط واضحة بدل فقرات طويلة، بحد أقصى 5-6 نقاط.
- مهم جداً: أنهِ إجابتك دائماً بشكل كامل ومترابط، لا تقطع الجملة أو الفكرة في المنتصف.
- إذا سُئلت عن شيء خارج نطاق المتجر أو التسويق، وجّه المستخدم بلطف للسؤال عن متجره.
- بعد كل رد، اقترح 3 أسئلة أو طلبات متابعة قصيرة (3-6 كلمات) منطقية بناءً على سياق المحادثة والرد اللي عطيته — تساعد التاجر يكمل يستفيد من المحادثة.

أعد ردك بصيغة JSON فقط بهذا الشكل بالضبط:
{"reply": "نص الرد الكامل هنا", "suggestions": ["اقتراح متابعة 1", "اقتراح متابعة 2", "اقتراح متابعة 3"]}`;
  }
  return `You are "Mawq3i AI Advisor" — an e-commerce marketing expert for small merchants in Palestine and Jordan.
You're speaking with the owner of store "${storeName}" on the Mawq3i platform.

Current store data (products, stock, orders, sales):
${summary}

Instructions:
- Always answer concisely and practically, in short actionable points.
- Base your answer only on the real data provided above — never invent numbers or products.
- Suggest concrete actions: discounts, bundles, timing, product description tweaks, etc.
- If asked something unrelated to the store or marketing, gently redirect.
- After each reply, suggest 3 short (3-6 word) natural follow-up questions or requests based on the conversation so far.

Respond in JSON only, in exactly this shape:
{"reply": "full reply text here", "suggestions": ["follow-up 1", "follow-up 2", "follow-up 3"]}`;
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
    const { storeId, storeName, summary, messages, language } = req.body || {};

    if (!storeId || !storeName || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing storeId, storeName, or messages' });
      return;
    }

    const isAr = language !== 'en';
    const systemPrompt = buildSystemPrompt(storeName, summary || '(لا توجد بيانات كافية بعد)', isAr);

    // Keep only the last 12 turns to control token usage
    const recentMessages = messages.slice(-12);

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map((m) => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content,
      })),
    ];

    const openaiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: chatMessages,
        temperature: 0.6,
        max_tokens: 1536,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI API error:', openaiRes.status, errText);
      res.status(502).json({ error: 'AI provider error', detail: errText.slice(0, 500) });
      return;
    }

    const data = await openaiRes.json();
    const rawText = data?.choices?.[0]?.message?.content || '';

    let reply = '';
    let suggestions = [];
    try {
      const parsed = JSON.parse(rawText);
      reply = typeof parsed.reply === 'string' ? parsed.reply : '';
      suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s) => typeof s === 'string').slice(0, 3) : [];
    } catch {
      // Model didn't return valid JSON (rare) — fall back to raw text, no suggestions
      reply = rawText;
    }

    if (!reply) {
      reply = isAr ? 'ما قدرت أطلع رد، جرب تاني.' : 'Could not generate a reply, please try again.';
    }

    await logUsageEvent(storeId, 'ai_advisor');

    res.status(200).json({ reply, suggestions });
  } catch (err) {
    console.error('ai-advisor handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
