const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/edits';
const OPENAI_IMAGE_MODEL = 'gpt-image-1-mini';

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Image enhancement is not configured (missing OPENAI_API_KEY)' });
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

    // Build a multipart/form-data request for the OpenAI image edit endpoint
    const buffer = Buffer.from(imageBase64, 'base64');
    const blob = new Blob([buffer], { type: mimeType || 'image/jpeg' });

    const form = new FormData();
    form.append('image', blob, 'product.jpg');
    form.append('prompt', prompt);
    form.append('model', OPENAI_IMAGE_MODEL);
    form.append('quality', 'medium');
    form.append('size', '1024x1024');
    form.append('n', '1');

    const openaiRes = await fetch(OPENAI_IMAGES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI image API error:', openaiRes.status, errText);
      res.status(502).json({ error: 'AI provider error', detail: errText.slice(0, 500) });
      return;
    }

    const data = await openaiRes.json();
    const b64 = data?.data?.[0]?.b64_json;

    if (!b64) {
      res.status(502).json({ error: isAr ? 'ما قدر الذكاء الاصطناعي يحسّن الصورة، جرب صورة ثانية' : 'AI could not enhance this image, try another one' });
      return;
    }

    res.status(200).json({
      imageBase64: b64,
      mimeType: 'image/png',
    });
  } catch (err) {
    console.error('enhance-image handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
