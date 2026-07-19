import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2, Check, ChevronLeft, ChevronRight, Loader2, Plus, Trash2,
  Image as ImageIcon, ExternalLink, CheckCircle2, AlertCircle, Copy,
  Store as StoreIcon, Palette, Package, Rocket, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { supabase, adminRest } from '@/lib/supabase';
import { uploadProductImage } from '@/lib/storage';

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────
interface StoreTemplate {
  id: string;
  key: string;
  name_ar: string;
  name_en: string;
  category: string;
  description_ar: string;
  default_accent: string;
  has_hover_shade: boolean;
  html_content?: string;
}

interface DraftProduct {
  localId: string;
  name_ar: string;
  price: string;
  category: string;
  desc_ar: string;
  badge: string;
  variantName: string;
  variantOptions: string; // comma separated
  file: File | null;
  previewUrl: string | null;
  uploadedUrl: string | null;
}

type Step = 'template' | 'info' | 'products' | 'review';

const emptyProduct = (): DraftProduct => ({
  localId: Math.random().toString(36).slice(2),
  name_ar: '', price: '', category: '', desc_ar: '', badge: '',
  variantName: '', variantOptions: '', file: null, previewUrl: null, uploadedUrl: null,
});

function toSlug(name: string) {
  const cleaned = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
  return cleaned || '';
}

function isValidSlug(s: string) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
}

// Darken a hex color by a percentage (0-1) — used to derive the hover shade
// for templates whose CSS needs a distinct {{ACCENT_HOVER}} value.
function darkenHex(hex: string, amount = 0.16): string {
  const m = hex.replace('#', '');
  if (m.length !== 6) return hex;
  const num = parseInt(m, 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function buildSiteHtml(template: StoreTemplate, opts: {
  storeName: string; slug: string; wa: string; accent: string;
}): string {
  let html = template.html_content || '';
  html = html.split('{{STORE_NAME}}').join(opts.storeName);
  html = html.split('{{STORE_SLUG}}').join(opts.slug);
  html = html.split('{{WA_NUMBER}}').join(opts.wa);
  html = html.split('{{ACCENT_COLOR}}').join(opts.accent);
  html = html.split('{{ACCENT_HOVER}}').join(darkenHex(opts.accent));
  return html;
}

// Secure-db GitHub actions (server-side token, admin-gated — see api/secure-db.js)
async function callSecureDbGithub(action: 'github_create_repo' | 'github_push_file', extraBody: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');
  const res = await fetch('/api/secure-db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, action, body: extraBody }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `GitHub request failed: ${res.status}`);
  }
  return res.json();
}

export default function CreateStore() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>('template');

  const [templates, setTemplates] = useState<StoreTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<StoreTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<StoreTemplate | null>(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [wa, setWa] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [accent, setAccent] = useState('#3b82f6');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  const [products, setProducts] = useState<DraftProduct[]>([emptyProduct()]);

  const [storeId, setStoreId] = useState<string | null>(null);
  const [creatingStore, setCreatingStore] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishStage, setPublishStage] = useState('');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedRepoUrl, setPublishedRepoUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    adminRest.select('store_templates', 'select=id,key,name_ar,name_en,category,description_ar,default_accent,has_hover_shade,html_content&order=sort_order.asc')
      .then(rows => {
        setTemplates(rows as StoreTemplate[]);
        setLoadingTemplates(false);
      });
  }, []);

  function chooseTemplate(t: StoreTemplate) {
    setSelectedTemplate(t);
    setAccent(t.default_accent);
    setStep('info');
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim() || templates.length === 0) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('غير مسجل دخول');
      const res = await fetch('/api/secure-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          action: 'ai_generate_store_plan',
          body: {
            prompt: aiPrompt,
            templates: templates.map(t => ({ key: t.key, name_ar: t.name_ar, category: t.category, description_ar: t.description_ar })),
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'فشل التوليد');
      }
      const plan = await res.json();

      const matchedTemplate = templates.find(t => t.key === plan.template_key) || templates[0];
      setSelectedTemplate(matchedTemplate);
      setAccent(plan.accent_hex && /^#[0-9a-fA-F]{6}$/.test(plan.accent_hex) ? plan.accent_hex : matchedTemplate.default_accent);
      setName(plan.name_ar || '');
      const slugCandidate = toSlug(plan.name_en_slug_hint || plan.name_ar || '');
      setSlug(slugCandidate);
      setSlugEdited(true);

      const generatedProducts: DraftProduct[] = Array.isArray(plan.products) && plan.products.length
        ? plan.products.map((p: any) => ({
            localId: Math.random().toString(36).slice(2),
            name_ar: p.name_ar || '',
            price: p.price != null ? String(p.price) : '',
            category: p.category || '',
            desc_ar: p.desc_ar || '',
            badge: p.badge || '',
            variantName: p.variant_name || '',
            variantOptions: p.variant_options || '',
            file: null, previewUrl: null, uploadedUrl: null,
          }))
        : [emptyProduct()];
      setProducts(generatedProducts);
      setAiFilled(true);
      setStep('info');
    } catch (e: any) {
      setAiError(e?.message || 'حدث خطأ أثناء التوليد');
    } finally {
      setAiGenerating(false);
    }
  }

  function handleNameChange(v: string) {
    setName(v);
    if (!slugEdited) setSlug(toSlug(v));
  }

  // Step 2 -> 3: create the store row now so product images can be uploaded
  // against a real storeId (uploadProductImage needs it for the storage path).
  async function handleInfoNext() {
    if (!name.trim() || !isValidSlug(slug) || !wa.trim()) return;
    if (storeId) { setStep('products'); return; } // already created (going back and forth)
    setCreatingStore(true);
    try {
      const created = await adminRest.insert('stores', {
        name, slug, domain: customDomain.trim() || `${slug}.mawq3i.co`,
        owner_email: ownerEmail || null,
        owner_phone: wa,
        currency: 'ILS',
        status: 'active',
        primary_color: accent,
        subscription_status: 'trial',
        subscription_plan: 'yearly',
        subscription_paid: false,
        renewal_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        join_date: new Date().toISOString().slice(0, 10),
      });
      if (!created?.id) throw new Error('فشل إنشاء المتجر');
      setStoreId(created.id);

      if (ownerEmail && ownerPassword) {
        const authResult = await adminRest.authCreateUser(ownerEmail, ownerPassword);
        if (authResult?.id) {
          await adminRest.update('stores', `id=eq.${created.id}`, { owner_id: authResult.id });
        }
      }
      setStep('products');
    } catch (e) {
      alert('تعذر إنشاء المتجر، حاول مرة أخرى');
    } finally {
      setCreatingStore(false);
    }
  }

  function updateProduct(localId: string, patch: Partial<DraftProduct>) {
    setProducts(prev => prev.map(p => p.localId === localId ? { ...p, ...patch } : p));
  }

  function addProductRow() {
    setProducts(prev => [...prev, emptyProduct()]);
  }

  function removeProductRow(localId: string) {
    setProducts(prev => prev.filter(p => p.localId !== localId).length ? prev.filter(p => p.localId !== localId) : prev);
  }

  function handleFileSelect(localId: string, file: File | null) {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    updateProduct(localId, { file, previewUrl });
  }

  // Step 3 -> 4: upload any pending images, insert product rows.
  async function handleProductsNext() {
    if (!storeId) return;
    setCreatingStore(true);
    try {
      for (const p of products) {
        if (!p.name_ar.trim() || !p.price.trim()) continue;
        let imageUrl = p.uploadedUrl;
        if (p.file && !imageUrl) {
          imageUrl = await uploadProductImage(p.file, storeId);
        }
        const variants = p.variantName.trim() && p.variantOptions.trim()
          ? [{ name: p.variantName.trim(), options: p.variantOptions.split(/[,،]/).map(o => o.trim()).filter(Boolean) }]
          : [];
        await adminRest.insert('products', {
          store_id: storeId,
          name_ar: p.name_ar.trim(),
          name_en: p.name_ar.trim(),
          desc_ar: p.desc_ar.trim(),
          desc_en: p.desc_ar.trim(),
          price: Number(p.price) || 0,
          currency: 'ILS',
          stock: 100,
          category: p.category.trim() || 'عام',
          status: 'visible',
          image_url: imageUrl,
          badge: p.badge.trim() || null,
          variants,
        });
      }
      setStep('review');
    } catch {
      alert('حدث خطأ أثناء حفظ المنتجات، تحقق واعد المحاولة');
    } finally {
      setCreatingStore(false);
    }
  }

  async function handlePublish() {
    if (!selectedTemplate || !storeId) return;
    setPublishing(true);
    setPublishError(null);
    try {
      setPublishStage('إنشاء المستودع على GitHub...');
      await callSecureDbGithub('github_create_repo', { slug });

      setPublishStage('تجهيز ملف الموقع...');
      const html = buildSiteHtml(selectedTemplate, { storeName: name, slug, wa, accent });

      setPublishStage('رفع الموقع...');
      await callSecureDbGithub('github_push_file', {
        slug, htmlContent: html, message: `init: create ${slug} from template ${selectedTemplate.key}`,
      });

      setPublishedRepoUrl(`https://github.com/osamatamimii/${slug}-site`);
      setDone(true);
    } catch (e: any) {
      setPublishError(e?.message || 'فشل النشر');
    } finally {
      setPublishing(false);
      setPublishStage('');
    }
  }

  const vercelImportUrl = publishedRepoUrl
    ? `https://vercel.com/new/import?repository-url=${encodeURIComponent(publishedRepoUrl)}`
    : '#';

  const steps: { key: Step; label: string; icon: any }[] = [
    { key: 'template', label: 'التصميم', icon: Palette },
    { key: 'info', label: 'بيانات المتجر', icon: StoreIcon },
    { key: 'products', label: 'المنتجات', icon: Package },
    { key: 'review', label: 'النشر', icon: Rocket },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Wand2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">إنشاء متجر جديد</h1>
          <p className="text-sm text-muted-foreground">اختر تصميم، عبّي بيانات المتجر والمنتجات، وانشره خلال دقائق</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors
              ${i < stepIndex ? 'bg-primary text-primary-foreground' : i === stepIndex ? 'bg-primary/15 text-primary border-2 border-primary' : 'bg-muted text-muted-foreground'}`}>
              {i < stepIndex ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === stepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`h-0.5 flex-1 ${i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── STEP 1: TEMPLATE ── */}
        {step === 'template' && (
          <motion.div key="template" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="p-5 mb-6 border-primary/20 bg-primary/[0.03]">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm">ابنِ المتجر بالذكاء الاصطناعي</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">وصف المتجر ومنتجاته بجملة أو فقرة، وراح يختار التصميم المناسب ويجهز المنتجات — وتراجعها قبل ما تنشر أي شي</p>
                  </div>
                  <Textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="مثال: متجر عطور رجالية فخمة اسمه العود الملكي، بيبيع عطور شرقية وخشبية، أسعار بين ١٥٠-٤٠٠ شيكل"
                    rows={3}
                    className="bg-background"
                  />
                  {aiError && (
                    <div className="text-xs text-destructive flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {aiError}</div>
                  )}
                  <Button size="sm" disabled={!aiPrompt.trim() || aiGenerating} onClick={handleAiGenerate} className="gap-1.5">
                    {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {aiGenerating ? 'جاري البناء...' : 'ابنِ المتجر تلقائياً'}
                  </Button>
                </div>
              </div>
            </Card>

            <p className="text-xs text-muted-foreground mb-3">أو اختر تصميم يدوياً:</p>

            {loadingTemplates ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> جاري تحميل التصاميم...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {templates.map(t => (
                  <Card key={t.id} className="overflow-hidden group border-border hover:border-primary/40 transition-colors">
                    <div className="relative h-44 bg-muted cursor-pointer" onClick={() => setPreviewTemplate(t)}>
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${t.default_accent}22, ${t.default_accent}05)` }}>
                        <StoreIcon className="w-10 h-10" style={{ color: t.default_accent }} />
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="text-white text-sm font-semibold">معاينة مباشرة</span>
                      </div>
                      <div className="absolute top-3 left-3 w-5 h-5 rounded-full border-2 border-white shadow" style={{ background: t.default_accent }} />
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-sm">{t.name_ar}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{t.description_ar}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setPreviewTemplate(t)}>معاينة</Button>
                        <Button size="sm" className="flex-1" onClick={() => chooseTemplate(t)}>اختيار</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── STEP 2: INFO ── */}
        {step === 'info' && selectedTemplate && (
          <motion.div key="info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="max-w-xl mx-auto space-y-5">
              <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3 text-sm">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ background: accent }} />
                <span>التصميم المختار: <b>{selectedTemplate.name_ar}</b></span>
                <Button variant="ghost" size="sm" className="mr-auto h-7 px-2 text-xs" onClick={() => setStep('template')}>تغيير</Button>
              </div>

              {aiFilled && (
                <div className="bg-primary/[0.06] border border-primary/20 rounded-xl p-3 flex items-center gap-2 text-xs text-primary">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  عبّينا الاسم واللون والمنتجات بالذكاء الاصطناعي — راجعهم وعدّل أي شي قبل ما تكمل، وضيف رقم واتساب المتجر الحقيقي
                </div>
              )}

              <div className="space-y-2">
                <Label>اسم المتجر (عربي)</Label>
                <Input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="مثال: متجر الأناقة" />
              </div>

              <div className="space-y-2">
                <Label>الرابط (slug) — بالإنجليزي فقط</Label>
                <div className="flex items-center gap-2">
                  <Input value={slug} onChange={e => { setSlug(toSlug(e.target.value) || e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugEdited(true); }} placeholder="elegance" dir="ltr" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">.mawq3i.co</span>
                </div>
                {slug && !isValidSlug(slug) && (
                  <p className="text-xs text-destructive">الرابط لازم يكون بأحرف إنجليزية وأرقام وشرطات فقط</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>رقم واتساب المتجر (بصيغة دولية بدون +)</Label>
                <Input value={wa} onChange={e => setWa(e.target.value.replace(/[^\d]/g, ''))} placeholder="970599000000" dir="ltr" />
              </div>

              <div className="space-y-2">
                <Label>دومين مخصص (اختياري)</Label>
                <Input value={customDomain} onChange={e => setCustomDomain(e.target.value.trim().toLowerCase())} placeholder={`مثال: mystore.com — اتركه فاضي لاستخدام ${slug || '...'}.mawq3i.co`} dir="ltr" />
                <p className="text-xs text-muted-foreground">إذا عند التاجر دومين خاص فيه (مش من موقعي)، حطه هون بدل الرابط الفرعي</p>
              </div>

              <div className="space-y-2">
                <Label>اللون الرئيسي</Label>
                <div className="flex items-center gap-3">
                  <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="w-12 h-9 rounded-lg border border-border cursor-pointer bg-transparent" />
                  <Input value={accent} onChange={e => setAccent(e.target.value)} dir="ltr" className="flex-1" />
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <p className="text-xs text-muted-foreground">حساب صاحب المتجر (اختياري — تقدر تضيفه لاحقاً من صفحة المتاجر)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">البريد الإلكتروني</Label>
                    <Input value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="owner@example.com" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">كلمة المرور</Label>
                    <Input value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} type="text" dir="ltr" />
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('template')}><ChevronRight className="w-4 h-4 ml-1" /> رجوع</Button>
                <Button disabled={!name.trim() || !isValidSlug(slug) || !wa.trim() || creatingStore} onClick={handleInfoNext}>
                  {creatingStore ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
                  التالي <ChevronLeft className="w-4 h-4 mr-1" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: PRODUCTS ── */}
        {step === 'products' && (
          <motion.div key="products" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="max-w-3xl mx-auto space-y-4">
              <p className="text-sm text-muted-foreground">ضيف منتجات أولية (تقدر تضيف وتعدّل المزيد لاحقاً من لوحة التاجر)</p>

              {products.map((p, idx) => (
                <Card key={p.localId} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">منتج {idx + 1}</span>
                    {products.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => removeProductRow(p.localId)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[100px_1fr] gap-3">
                    <label className="w-full md:w-[100px] h-[100px] rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden bg-muted/30 shrink-0">
                      {p.previewUrl ? (
                        <img src={p.previewUrl} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleFileSelect(p.localId, e.target.files?.[0] || null)} />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="اسم المنتج" value={p.name_ar} onChange={e => updateProduct(p.localId, { name_ar: e.target.value })} />
                      <Input placeholder="السعر (₪)" type="number" value={p.price} onChange={e => updateProduct(p.localId, { price: e.target.value })} dir="ltr" />
                      <Input placeholder="الفئة (مثال: قمصان)" value={p.category} onChange={e => updateProduct(p.localId, { category: e.target.value })} />
                      <Input placeholder="شارة (جديد / تخفيض)" value={p.badge} onChange={e => updateProduct(p.localId, { badge: e.target.value })} />
                      <Input placeholder="اسم الخيار (مثال: اللون)" value={p.variantName} onChange={e => updateProduct(p.localId, { variantName: e.target.value })} />
                      <Input placeholder="القيم مفصولة بفاصلة (أحمر، أزرق)" value={p.variantOptions} onChange={e => updateProduct(p.localId, { variantOptions: e.target.value })} />
                    </div>
                  </div>
                  <Textarea placeholder="وصف قصير للمنتج" rows={2} value={p.desc_ar} onChange={e => updateProduct(p.localId, { desc_ar: e.target.value })} />
                </Card>
              ))}

              <Button variant="outline" className="w-full" onClick={addProductRow}>
                <Plus className="w-4 h-4 ml-1" /> إضافة منتج آخر
              </Button>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('info')}><ChevronRight className="w-4 h-4 ml-1" /> رجوع</Button>
                <Button disabled={creatingStore} onClick={handleProductsNext}>
                  {creatingStore ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
                  التالي <ChevronLeft className="w-4 h-4 mr-1" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 4: REVIEW / PUBLISH ── */}
        {step === 'review' && selectedTemplate && (
          <motion.div key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="max-w-xl mx-auto space-y-5">
              {!done ? (
                <>
                  <Card className="p-5 space-y-3">
                    <h3 className="font-semibold text-sm mb-2">ملخص المتجر</h3>
                    {[
                      ['الاسم', name],
                      ['الرابط', customDomain || `${slug}.mawq3i.co`],
                      ['التصميم', selectedTemplate.name_ar],
                      ['واتساب', wa],
                      ['عدد المنتجات', String(products.filter(p => p.name_ar.trim()).length)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between text-sm py-1.5 border-b border-border last:border-0">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </Card>

                  {publishError && (
                    <div className="bg-red-500/10 text-red-600 text-sm rounded-xl p-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {publishError}
                    </div>
                  )}

                  <Button className="w-full h-12 text-base" disabled={publishing} onClick={handlePublish}>
                    {publishing ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Rocket className="w-5 h-5 ml-2" />}
                    {publishing ? publishStage || 'جاري النشر...' : 'إنشاء الموقع الآن'}
                  </Button>

                  <div className="flex justify-start">
                    <Button variant="outline" onClick={() => setStep('products')}><ChevronRight className="w-4 h-4 ml-1" /> رجوع</Button>
                  </div>
                </>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col items-center text-center gap-3 py-4">
                    <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7 text-green-500" />
                    </div>
                    <h2 className="text-lg font-bold">تم إنشاء كود الموقع بنجاح!</h2>
                    <p className="text-sm text-muted-foreground">بقيت خطوتان بسيطتان يدويتان لتفعيل الرابط النهائي</p>
                  </div>

                  <Card className="p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">1</div>
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium">استورد المستودع على Vercel</p>
                        <p className="text-xs text-muted-foreground">اضغط الزر، اختر الفريق osamatamimiis-projects، واضغط Deploy — Vercel هيبني وينشر تلقائياً.</p>
                        <a href={vercelImportUrl} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="gap-1.5">
                            استيراد إلى Vercel <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">2</div>
                      <div className="flex-1 space-y-2">
                        {customDomain ? (
                          <>
                            <p className="text-sm font-medium">أضف الدومين بمشروع Vercel وعلى DNS بتاع التاجر</p>
                            <p className="text-xs text-muted-foreground">Vercel → المشروع → Settings → Domains → Add، حط <b dir="ltr">{customDomain}</b></p>
                            <p className="text-xs text-muted-foreground">بعدين عند مزود الدومين (اللي التاجر اشترى منه الدومين):</p>
                            <div className="bg-muted/40 rounded-lg p-2.5 text-xs font-mono space-y-1" dir="ltr">
                              {customDomain.split('.').length > 2 ? (
                                <>
                                  <div>Type: CNAME</div>
                                  <div>Host: <b>{customDomain.split('.')[0]}</b></div>
                                  <div>Value: <b>cname.vercel-dns.com</b></div>
                                </>
                              ) : (
                                <>
                                  <div>Type: A — Host: @ — Value: <b>76.76.21.21</b></div>
                                  <div>Type: CNAME — Host: www — Value: <b>cname.vercel-dns.com</b></div>
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium">أضف الدومين الفرعي على Namecheap</p>
                            <p className="text-xs text-muted-foreground">Advanced DNS → Add New Record → CNAME</p>
                            <div className="bg-muted/40 rounded-lg p-2.5 text-xs font-mono space-y-1" dir="ltr">
                              <div>Host: <b>{slug}</b></div>
                              <div>Value: <b>cname.vercel-dns.com</b></div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setLocation('/admin/stores')}>الذهاب لصفحة المتاجر</Button>
                    <Button className="flex-1" onClick={() => {
                      setStep('template'); setSelectedTemplate(null); setName(''); setSlug(''); setSlugEdited(false);
                      setWa(''); setCustomDomain(''); setOwnerEmail(''); setOwnerPassword(''); setProducts([emptyProduct()]);
                      setStoreId(null); setDone(false); setPublishedRepoUrl(null);
                      setAiPrompt(''); setAiFilled(false); setAiError(null);
                    }}>إنشاء متجر آخر</Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live preview modal */}
      <AnimatePresence>
        {previewTemplate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewTemplate(null)}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              className="bg-background rounded-2xl overflow-hidden w-full max-w-4xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h3 className="font-semibold text-sm">{previewTemplate.name_ar}</h3>
                  <p className="text-xs text-muted-foreground">معاينة حية — بدون بيانات حقيقية</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { chooseTemplate(previewTemplate); setPreviewTemplate(null); }}>اختيار هذا التصميم</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPreviewTemplate(null)}>إغلاق</Button>
                </div>
              </div>
              <iframe
                className="flex-1 w-full bg-white"
                srcDoc={buildSiteHtml(previewTemplate, { storeName: 'اسم المتجر', slug: 'demo', wa: '970599000000', accent: previewTemplate.default_accent })}
                sandbox=""
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
