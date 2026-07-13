const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/edits';
const OPENAI_IMAGE_MODEL = 'gpt-image-2';

// Supported output sizes, mapped to friendly labels for the response.
const ALLOWED_SIZES = ['1024x1024', '1024x1536', '1536x1024'];
const MAX_TOTAL_IMAGES = 6; // guardrail on cost/time — sizes × count is clamped to this

function buildPrompt(userPrompt, isAr) {
  const scene = (userPrompt || '').trim();

  if (isAr) {
    let p = 'أنت خبير تصوير منتجات تجارية احترافي. مهمتك تحرير صورة المنتج المرفقة لإنشاء صورة ترويجية احترافية.\n\n';
    p += 'التزم بهذا بدقة:\n';
    p += '- المنتج نفسه (شكله، ألوانه، تفاصيله، وأي نص أو شعار مطبوع عليه) يجب أن يبقى مطابقاً تماماً للأصل بلا أي تغيير أو تشويه.\n';
    if (scene) {
      p += `- غيّر المشهد/الخلفية/الإضاءة بالكامل بحيث يعكس هذا الوصف بدقة: "${scene}". هذا التغيير إلزامي.\n`;
    } else {
      p += '- اجعل الخلفية والإضاءة بجودة استوديو احترافية وجذابة تناسب صورة ترويجية.\n';
    }
    p += '- أضف ظلاً وانعكاساً واقعياً يتناسب مع المشهد الجديد، وحافظ على تناسق الإضاءة.\n';
    p += '- النتيجة يجب أن تبدو كصورة تسويقية احترافية جاهزة للنشر على السوشال ميديا، لا صورة معدّلة بشكل واضح.';
    return p;
  }

  let p = 'You are a professional product photography expert. Edit the attached product photo to create a professional promotional image.\n\n';
  p += 'Follow these rules precisely:\n';
  p += "- The product itself (shape, colors, details, and any printed text/logo) must remain exactly identical to the original — no alteration or distortion.\n";
  if (scene) {
    p += `- Fully change the scene/background/lighting to precisely reflect this description: "${scene}". This change is mandatory.\n`;
  } else {
    p += '- Make the background and lighting professional, studio-quality, and appealing for a promotional image.\n';
  }
  p += '- Add realistic shadow/reflection matching the new scene, with consistent lighting.\n';
  p += "- The result should look like a professionally shot marketing photo, not an obviously edited one.";
  return p;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Image generation is not configured (missing OPENAI_API_KEY)' });
    return;
  }

  try {
    const { imageUrl, prompt, sizes, count, language } = req.body || {};
    if (!imageUrl) {
      res.status(400).json({ error: 'Missing imageUrl' });
      return;
    }

    const isAr = language !== 'en';
    let requestedSizes = Array.isArray(sizes) && sizes.length
      ? sizes.filter((s) => ALLOWED_SIZES.includes(s))
      : ['1024x1024'];
    if (!requestedSizes.length) requestedSizes = ['1024x1024'];

    let n = Number.isFinite(count) ? Math.max(1, Math.min(4, Math.floor(count))) : 1;

    // Clamp total images (sizes × n) to the guardrail, trimming sizes first if needed.
    while (requestedSizes.length * n > MAX_TOTAL_IMAGES && requestedSizes.length > 1) {
      requestedSizes = requestedSizes.slice(0, requestedSizes.length - 1);
    }
    while (requestedSizes.length * n > MAX_TOTAL_IMAGES && n > 1) {
      n -= 1;
    }

    // Fetch the source product image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      res.status(400).json({ error: isAr ? 'تعذّر تحميل صورة المنتج' : 'Could not load the product image' });
      return;
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

    const finalPrompt = buildPrompt(prompt, isAr);

    const callForSize = async (size) => {
      const blob = new Blob([buffer], { type: contentType });
      const form = new FormData();
      form.append('image', blob, 'product.jpg');
      form.append('prompt', finalPrompt);
      form.append('model', OPENAI_IMAGE_MODEL);
      form.append('quality', 'high');
      form.append('size', size);
      form.append('n', String(n));

      const openaiRes = await fetch(OPENAI_IMAGES_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        console.error('OpenAI image API error:', size, openaiRes.status, errText);
        return { size, images: [], error: true };
      }

      const data = await openaiRes.json();
      const images = (data?.data || [])
        .map((d) => d?.b64_json)
        .filter(Boolean);
      return { size, images, error: false };
    };

    const results = await Promise.all(requestedSizes.map(callForSize));
    const allFailed = results.every((r) => r.error || !r.images.length);

    if (allFailed) {
      res.status(502).json({ error: isAr ? 'ما قدر الذكاء الاصطناعي يولّد الصور، جرب برومت مختلف' : 'AI could not generate images, try a different prompt' });
      return;
    }

    res.status(200).json({
      results: results.map((r) => ({ size: r.size, images: r.images })),
      mimeType: 'image/png',
    });
  } catch (err) {
    console.error('marketing-image handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
