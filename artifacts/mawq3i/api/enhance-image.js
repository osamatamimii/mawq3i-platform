export const config = { maxDuration: 60 };

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/edits';
const OPENAI_IMAGE_MODEL = 'gpt-image-2';
const ALLOWED_SIZES = ['1024x1024', '1024x1536', '1536x1024'];
const MAX_TOTAL_IMAGES = 6; // guardrail on cost/time for the multi-image 'promo' mode

function buildEnhancePrompt(brandIdentity, isAr) {
  const hasIdentity = brandIdentity && brandIdentity.trim();

  if (isAr) {
    let p = 'أنت خبير تصوير منتجات تجارية احترافي. مهمتك تحرير صورة المنتج المرفقة لتبدو بجودة استوديو احترافية.\n\n';
    p += 'التزم بهذا بدقة:\n';
    p += '- المنتج نفسه (وأي يد أو شخص يحمله إن وجد) يجب أن يبقى كما هو تماماً بلا أي تغيير في الشكل أو التفاصيل أو الألوان أو الوضعية.\n';
    p += '- أي نص أو شعار أو كتابة مطبوعة على المنتج يجب أن تبقى واضحة ومطابقة تماماً للأصل — لا تحذفها ولا تشوّهها ولا تغيّرها بأي شكل.\n';
    if (hasIdentity) {
      p += `- استبدل الخلفية بالكامل (إزالة الخلفية الأصلية نهائياً) واستبدلها بالوصف التالي بدقة، حتى لو كانت الخلفية الأصلية بسيطة أو محايدة: "${brandIdentity.trim()}". هذا التغيير إلزامي وليس اقتراحاً — لا تكتفِ بتحسين الخلفية الأصلية، غيّرها فعلياً بالكامل.\n`;
    } else {
      p += '- اجعل الخلفية نظيفة ومرتبة وغير مشتتة (خلفية استوديو بسيطة).\n';
    }
    p += '- حسّن الإضاءة لتكون ناعمة ومتوازنة، وأضف ظلاً خفيفاً واقعياً تحت المنتج يتناسب مع الخلفية الجديدة.\n';
    p += '- حافظ على نسب ووضوح المنتج كما هي، فقط بجودة أعلى ووضوح أفضل.';
    return p;
  }

  let p = 'You are a professional product photography expert. Edit the attached product photo to studio-quality.\n\n';
  p += 'Follow these rules precisely:\n';
  p += '- The product itself (and any hand/person holding it, if present) must remain exactly as-is — no change to shape, details, colors, or pose.\n';
  p += '- Any printed text, logo, or branding on the product must remain sharp and identical to the original — do not remove, distort, or alter it in any way.\n';
  if (hasIdentity) {
    p += `- Fully replace the background (completely remove the original background) with the following, even if the original background is already simple or neutral: "${brandIdentity.trim()}". This is a mandatory change, not a suggestion — do not merely enhance the existing background, actually replace it.\n`;
  } else {
    p += '- Make the background clean, tidy, and uncluttered (simple studio backdrop).\n';
  }
  p += '- Improve lighting to be soft and balanced, and add a subtle realistic shadow under the product matching the new background.\n';
  p += "- Keep the product's proportions and clarity intact, just at higher quality and sharpness.";
  return p;
}

function buildPromoPrompt(userPrompt, isAr) {
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

async function callImageEdit(apiKey, buffer, contentType, prompt, size, n, quality) {
  const blob = new Blob([buffer], { type: contentType });
  const form = new FormData();
  form.append('image', blob, 'product.jpg');
  form.append('prompt', prompt);
  form.append('model', OPENAI_IMAGE_MODEL);
  form.append('quality', quality);
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
    return { images: [], error: true };
  }

  const data = await openaiRes.json();
  const images = (data?.data || []).map((d) => d?.b64_json).filter(Boolean);
  return { images, error: false };
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

  const isAr = req.body?.language !== 'en';

  try {
    if (req.body?.mode === 'promo') {
      // ── Multi-size, multi-variation promotional image generation ──
      const { imageUrl, prompt, sizes, count } = req.body;
      if (!imageUrl) {
        res.status(400).json({ error: 'Missing imageUrl' });
        return;
      }

      let requestedSizes = Array.isArray(sizes) && sizes.length
        ? sizes.filter((s) => ALLOWED_SIZES.includes(s))
        : ['1024x1024'];
      if (!requestedSizes.length) requestedSizes = ['1024x1024'];

      let n = Number.isFinite(count) ? Math.max(1, Math.min(4, Math.floor(count))) : 1;
      while (requestedSizes.length * n > MAX_TOTAL_IMAGES && requestedSizes.length > 1) {
        requestedSizes = requestedSizes.slice(0, requestedSizes.length - 1);
      }
      while (requestedSizes.length * n > MAX_TOTAL_IMAGES && n > 1) {
        n -= 1;
      }

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        res.status(400).json({ error: isAr ? 'تعذّر تحميل صورة المنتج' : 'Could not load the product image' });
        return;
      }
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const finalPrompt = buildPromoPrompt(prompt, isAr);

      const results = await Promise.all(
        requestedSizes.map(async (size) => {
          const r = await callImageEdit(apiKey, buffer, contentType, finalPrompt, size, n, 'high');
          return { size, images: r.images };
        })
      );

      const allFailed = results.every((r) => !r.images.length);
      if (allFailed) {
        res.status(502).json({ error: isAr ? 'ما قدر الذكاء الاصطناعي يولّد الصور، جرب برومت مختلف' : 'AI could not generate images, try a different prompt' });
        return;
      }

      res.status(200).json({ results, mimeType: 'image/png' });
      return;
    }

    // ── Default mode: single product-photo enhancement (background replace/cleanup) ──
    const { imageBase64, mimeType, brandIdentity } = req.body || {};
    if (!imageBase64) {
      res.status(400).json({ error: 'Missing imageBase64' });
      return;
    }

    const prompt = buildEnhancePrompt(brandIdentity, isAr);
    const buffer = Buffer.from(imageBase64, 'base64');
    const r = await callImageEdit(apiKey, buffer, mimeType || 'image/jpeg', prompt, '1024x1024', 1, 'medium');

    if (!r.images.length) {
      res.status(502).json({ error: isAr ? 'ما قدر الذكاء الاصطناعي يحسّن الصورة، جرب صورة ثانية' : 'AI could not enhance this image, try another one' });
      return;
    }

    res.status(200).json({ imageBase64: r.images[0], mimeType: 'image/png' });
  } catch (err) {
    console.error('enhance-image handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
