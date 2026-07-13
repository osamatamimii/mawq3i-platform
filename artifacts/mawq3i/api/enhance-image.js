const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/edits';
const OPENAI_IMAGE_MODEL = 'gpt-image-2';
const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';
const MONTHLY_IMAGE_LIMIT = 100;

async function getMonthlyImageCount(storeId) {
  const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/ai_image_generations?store_id=eq.${storeId}&created_at=gte.${startOfMonth}&select=id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact' } }
  );
  const range = r.headers.get('content-range'); // e.g. "0-9/45"
  if (!range) return 0;
  const total = parseInt(range.split('/')[1], 10);
  return Number.isFinite(total) ? total : 0;
}

async function logImageGeneration(storeId) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ai_image_generations`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ store_id: storeId }),
    });
  } catch (e) {
    console.error('logImageGeneration failed:', e);
  }
}

function buildPrompt(brandIdentity, isAr) {
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
    const { imageBase64, mimeType, brandIdentity, language, storeId } = req.body || {};
    if (!imageBase64) {
      res.status(400).json({ error: 'Missing imageBase64' });
      return;
    }

    const isAr = language !== 'en';

    if (storeId) {
      const usedThisMonth = await getMonthlyImageCount(storeId);
      if (usedThisMonth >= MONTHLY_IMAGE_LIMIT) {
        res.status(200).json({
          limitReached: true,
          error: isAr
            ? `وصلت للحد الأقصى الشهري لتحسين الصور بالذكاء الاصطناعي (${MONTHLY_IMAGE_LIMIT} صورة). الحد بيتجدد أول الشهر الجاي.`
            : `You've reached the monthly AI image limit (${MONTHLY_IMAGE_LIMIT} images). The limit resets at the start of next month.`,
        });
        return;
      }
    }

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

    if (storeId) await logImageGeneration(storeId);

    res.status(200).json({
      imageBase64: b64,
      mimeType: 'image/png',
    });
  } catch (err) {
    console.error('enhance-image handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
