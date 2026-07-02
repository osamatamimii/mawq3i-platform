const GEMINI_MODEL = 'gemini-3.1-flash-lite-image';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function buildPrompt(brandIdentity, isAr) {
  const base = isAr
    ? 'أنت خبير تصوير منتجات تجارية احترافي. حسّن صورة المنتج المرفقة لتبدو بجودة استوديو احترافية: إضاءة نظيفة ومتوازنة، خلفية مرتبة وغير مشتتة، ألوان طبيعية وحادة. لا تغيّر شكل المنتج نفسه أو تفاصيله أو نسبه — فقط حسّن العرض والخلفية والإضاءة. حافظ على أن يكون المنتج هو نفسه تماماً.'
    : 'You are a professional product photography expert. Enhance the attached product photo to studio-quality: clean balanced lighting, tidy uncluttered background, natural sharp colors. Do not change the product itself, its shape, details, or proportions — only improve presentation, background, and lighting. The product must remain exactly the same.';

  if (brandIdentity && brandIdentity.trim()) {
    return base + (isAr
      ? `\n\nالهوية البصرية الخاصة بهذا المتجر (طبّقها بثبات): ${brandIdentity.trim()}`
      : `\n\nThis store's brand identity (apply it consistently): ${brandIdentity.trim()}`);
  }
  return base;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Image enhancement is not configured (missing GEMINI_API_KEY)' });
    return;
  }

  try {
    const { imageBase64, mimeType, brandIdentity, language } = req.body || {};
    if (!imageBase64) {
      res.status(400).json({ error: 'Missing imageBase64' });
      return;
    }

    const isAr = language !== 'en';
    const prompt = buildPrompt(brandIdentity, isAr);

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['Image'],
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini image API error:', geminiRes.status, errText);
      res.status(502).json({ error: 'AI provider error', detail: errText.slice(0, 500) });
      return;
    }

    const data = await geminiRes.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData || p.inline_data);
    const inline = imagePart?.inlineData || imagePart?.inline_data;

    if (!inline?.data) {
      res.status(502).json({ error: isAr ? 'ما قدر الذكاء الاصطناعي يحسّن الصورة، جرب صورة ثانية' : 'AI could not enhance this image, try another one' });
      return;
    }

    res.status(200).json({
      imageBase64: inline.data,
      mimeType: inline.mimeType || inline.mime_type || 'image/png',
    });
  } catch (err) {
    console.error('enhance-image handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
