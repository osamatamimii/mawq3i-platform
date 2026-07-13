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

// Per-field-type instructions — keeps each field's enhancement style appropriate
// (a product description needs different guidance than a short promo tag).
const FIELD_GUIDANCE = {
  product_name: {
    ar: 'اسم منتج جذاب وواضح لمتجر إلكتروني. لا يتجاوز 8 كلمات. لا تخترع تفاصيل غير مذكورة (مقاس/لون/مادة) إن لم تُذكر أصلاً.',
    en: 'A clear, appealing product name for an e-commerce store. Max 8 words. Do not invent details (size/color/material) not already given.',
  },
  product_description: {
    ar: 'وصف منتج مقنع وبيعي (2-4 جمل)، يبرز الفائدة للزبون مش بس المواصفات، بلهجة عربية سهلة وواضحة. لا تخترع مواصفات غير مذكورة بالنص الأصلي.',
    en: 'A persuasive, sales-oriented product description (2-4 sentences) that highlights customer benefit, not just specs. Do not invent specs not in the original text.',
  },
  promo_title: {
    ar: 'عنوان عرض/بانر ترويجي قصير وقوي (3-6 كلمات)، يخلق شعور بالحماس أو الإلحاح بدون مبالغة.',
    en: 'A short, punchy promo banner title (3-6 words) that creates excitement or urgency without overselling.',
  },
  promo_subtitle: {
    ar: 'وصف فرعي قصير لعرض ترويجي (جملة واحدة، أقل من 12 كلمة)، يوضح تفاصيل العرض بشكل جذاب.',
    en: 'A short promo subtitle (one sentence, under 12 words) that clarifies the offer in an appealing way.',
  },
  store_description: {
    ar: 'وصف/بايو متجر إلكتروني (2-3 جمل)، يعطي انطباع أول احترافي وموثوق، بلا مبالغة أو كلام عام فارغ.',
    en: 'An e-commerce store bio (2-3 sentences) that gives a professional, trustworthy first impression, no generic filler.',
  },
  social_post: {
    ar: 'منشور إنستغرام/فيسبوك ترويجي لمنتج، بلهجة عربية دارجة حماسية (مو فصحى رسمية)، يشمل: جملة افتتاحية تلفت الانتباه، ذكر السعر والميزة الأساسية، دعوة واضحة للطلب (مثل "اطلبه الحين 🛒" أو "الكمية محدودة")، وبنهايته 5-8 هاشتاقات مناسبة للسوق العربي المحلي (مزيج من هاشتاقات عامة للتسوق وهاشتاقات خاصة بنوع المنتج). لا تستخدم إيموجي أكتر من اللازم (3-5 بالمنشور كامل).',
    en: 'A promotional Instagram/Facebook post for a product, casual and energetic tone, including: an attention-grabbing opener, the price and key benefit, a clear call to order, and 5-8 relevant hashtags at the end (mix of general shopping hashtags and product-specific ones). Use emoji sparingly (3-5 total).',
  },
  whatsapp_broadcast: {
    ar: 'رسالة تسويقية قصيرة يرسلها صاحب المتجر لعملائه بشكل جماعي عبر واتساب (مو محادثة فردية). يجب أن تكون: مباشرة وقصيرة (4-7 أسطر قصيرة، تصلح للقراءة السريعة على الجوال)، بلهجة عربية دارجة ودّية ومو رسمية جداً، تبدأ بجملة تلفت الانتباه (مو "مرحباً" عادية)، توضح العرض/المناسبة بوضوح مع أي تفاصيل معطاة (نسبة خصم، تاريخ انتهاء، إلخ) بدون اختراع تفاصيل غير مذكورة، وتنتهي بدعوة واضحة للفعل. استخدم إيموجي قليلة ومناسبة (2-4). لا تضف رابط المتجر لأن صاحب المتجر رح يضيفه بنفسه.',
    en: 'A short marketing message a store owner sends to a broadcast list of customers on WhatsApp (not a 1:1 chat). It should be: direct and short (4-7 short lines, easy to skim on mobile), casual and friendly tone, open with an attention-grabbing line (not a plain "Hello"), clearly state the offer/occasion with any given details (discount %, expiry date, etc.) without inventing details not provided, and end with a clear call to action. Use a few relevant emoji (2-4). Do not add the store link since the owner will add it themselves.',
  },
};

function buildSystemPrompt(fieldType, isAr) {
  const guidance = FIELD_GUIDANCE[fieldType] || FIELD_GUIDANCE.product_description;
  const styleNote = isAr ? guidance.ar : guidance.en;

  if (isAr) {
    return `أنت مساعد كتابة تسويقية لمنصة متاجر إلكترونية عربية اسمها "موقعي" (Mawq3i).
مهمتك: تحسين نص كتبه صاحب متجر، مش استبداله بشيء غريب عنه.

نوع الحقل: ${fieldType}
التوجيه الخاص بهذا الحقل: ${styleNote}

قواعد صارمة:
- حافظ على المعنى والمعلومات الأصلية اللي كتبها التاجر، لا تخترع تفاصيل جديدة (سعر، مقاس، خامة، تاريخ) لم تُذكر.
- لا تستخدم كلمات ركيكة أو ترجمة حرفية، اكتب بعربي طبيعي يقرأه الزبون بارتياح.
- أعطِ 3 نسخ مختلفة الأسلوب (مو بس صياغة مرادفة) — مثلاً نسخة مباشرة، نسخة أكثر حماساً، نسخة مختصرة جداً.
- إذا كان النص الأصلي فارغاً أو غير مفهوم، أنشئ نصاً معقولاً بناءً على السياق المُعطى (اسم المتجر/الفئة) بدل الاعتذار.

أعد ردك بصيغة JSON فقط بهذا الشكل بالضبط:
{"suggestions": ["نسخة 1", "نسخة 2", "نسخة 3"]}`;
  }

  return `You are a marketing copywriting assistant for an Arabic e-commerce platform called "Mawq3i".
Your job: improve text a merchant wrote, not replace it with something unrelated.

Field type: ${fieldType}
Field-specific guidance: ${styleNote}

Strict rules:
- Preserve the original meaning and facts the merchant wrote; never invent new details (price, size, material, dates) not already present.
- Give 3 stylistically different versions (not just synonyms) — e.g. one direct, one more energetic, one very concise.
- If the original text is empty or unclear, generate a reasonable one based on the given context (store name/category) instead of refusing.

Respond in JSON only, in exactly this shape:
{"suggestions": ["version 1", "version 2", "version 3"]}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'AI enhance is not configured (missing OPENAI_API_KEY)' });
    return;
  }

  try {
    const { fieldType, currentText, context, language, storeId } = req.body || {};

    if (!fieldType) {
      res.status(400).json({ error: 'Missing fieldType' });
      return;
    }

    const isAr = language !== 'en';
    const systemPrompt = buildSystemPrompt(fieldType, isAr);

    const userContent = isAr
      ? `النص الحالي: ${currentText ? `"${currentText}"` : '(فارغ)'}\nسياق إضافي (اسم المتجر/الفئة/إلخ): ${context || '(لا يوجد)'}`
      : `Current text: ${currentText ? `"${currentText}"` : '(empty)'}\nAdditional context (store name/category/etc): ${context || '(none)'}`;

    const openaiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 900,
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

    let suggestions = [];
    try {
      const parsed = JSON.parse(rawText);
      suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((s) => typeof s === 'string' && s.trim()).slice(0, 3)
        : [];
    } catch {
      // Model didn't return valid JSON — no usable suggestions
      suggestions = [];
    }

    if (!suggestions.length) {
      res.status(200).json({
        suggestions: [],
        error: isAr ? 'ما قدرنا نولّد اقتراحات، جرب تاني.' : 'Could not generate suggestions, try again.',
      });
      return;
    }

    await logUsageEvent(storeId, `text:${fieldType}`);

    res.status(200).json({ suggestions });
  } catch (err) {
    console.error('enhance-text handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
