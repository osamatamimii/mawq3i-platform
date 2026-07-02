const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'AI advisor is not configured (missing GEMINI_API_KEY)' });
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

    const contents = recentMessages.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1536,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              reply: { type: 'STRING' },
              suggestions: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['reply', 'suggestions'],
          },
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      res.status(502).json({ error: 'AI provider error', detail: errText.slice(0, 500) });
      return;
    }

    const data = await geminiRes.json();
    const rawText =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';

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

    res.status(200).json({ reply, suggestions });
  } catch (err) {
    console.error('ai-advisor handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
