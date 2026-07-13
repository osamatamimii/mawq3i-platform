import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getProducts } from '@/lib/db';
import type { Product } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Megaphone, Sparkles, Loader2, Copy, Check, Image as ImageIcon,
  Download, MessageCircle, ChevronDown, Square, RectangleVertical, RectangleHorizontal,
} from 'lucide-react';

function getCurrencySymbol(currency: string): string {
  return currency === 'SAR' ? '﷼' : '₪';
}

export default function MarketingStudio() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [captions, setCaptions] = useState<string[]>([]);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [captionsError, setCaptionsError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const IMG_SIZES: { key: string; labelAr: string; labelEn: string; icon: typeof Square }[] = [
    { key: '1024x1024', labelAr: '1:1 مربع (منشور)', labelEn: '1:1 Square (Feed)', icon: Square },
    { key: '1024x1536', labelAr: '2:3 عمودي (ستوري)', labelEn: '2:3 Portrait (Story)', icon: RectangleVertical },
    { key: '1536x1024', labelAr: '3:2 أفقي (بانر)', labelEn: '3:2 Landscape (Banner)', icon: RectangleHorizontal },
  ];

  const [imgPrompt, setImgPrompt] = useState('');
  const [imgSelectedSize, setImgSelectedSize] = useState('1024x1024');
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState('');
  const [imgResults, setImgResults] = useState<{ size: string; urls: string[] }[]>([]);

  const [waPrompt, setWaPrompt] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState('');
  const [waCopied, setWaCopied] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    (async () => {
      setLoadingProducts(true);
      const rows = await getProducts(currentStore.id, isAdminMode);
      setProducts(rows);
      if (rows.length) setSelectedId(rows[0].id);
      setLoadingProducts(false);
    })();
  }, [currentStore?.id]);

  const selectedProduct = products.find(p => p.id === selectedId) || null;

  useEffect(() => {
    setCaptions([]);
    setCaptionsError('');
    setImgResults([]);
    setImgError('');
  }, [selectedId]);

  const generateCaptions = async () => {
    if (!selectedProduct || !currentStore) return;
    setCaptionsLoading(true);
    setCaptionsError('');
    try {
      const name = isAr ? selectedProduct.nameAr : selectedProduct.nameEn;
      const price = `${getCurrencySymbol(selectedProduct.currency)}${selectedProduct.price}`;
      const res = await fetch('/api/enhance-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldType: 'social_post',
          currentText: `${name} — ${price}${selectedProduct.descAr ? ' — ' + selectedProduct.descAr : ''}`,
          context: `${currentStore.name} — ${selectedProduct.category || ''}`,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.suggestions?.length) throw new Error(data.error || 'failed');
      setCaptions(data.suggestions);
    } catch {
      setCaptionsError(isAr ? 'ما قدرنا نولّد منشور، جرب تاني.' : 'Could not generate a post, try again.');
    } finally {
      setCaptionsLoading(false);
    }
  };

  const copyCaption = async (text: string, idx: number) => {
    try {
      const productUrl = currentStore?.domain
        ? `https://${currentStore.domain}/product?id=${selectedProduct?.id}`
        : `https://${currentStore?.slug}.mawq3i.co/product?id=${selectedProduct?.id}`;
      await navigator.clipboard.writeText(`${text}\n\n${productUrl}`);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2500);
      toast({ title: isAr ? '✅ تم نسخ المنشور' : '✅ Post copied' });
    } catch {
      toast({ title: isAr ? 'فشل النسخ' : 'Copy failed', variant: 'destructive' });
    }
  };

  const generateImages = async () => {
    if (!selectedProduct?.imageUrl) return;
    setImgLoading(true);
    setImgError('');
    setImgResults([]);
    try {
      const res = await fetch('/api/enhance-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'promo',
          imageUrl: selectedProduct.imageUrl,
          prompt: imgPrompt,
          sizes: [imgSelectedSize],
          count: 1,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.results?.length) throw new Error(data.error || 'failed');
      const results = (data.results as { size: string; images: string[] }[]).map(r => ({
        size: r.size,
        urls: r.images.map((b64) => `data:image/png;base64,${b64}`),
      }));
      setImgResults(results);
      if (!results.some(r => r.urls.length)) {
        setImgError(isAr ? 'ما قدرنا نولّد صور، جرب برومت مختلف' : 'Could not generate images, try a different prompt');
      }
    } catch {
      setImgError(isAr ? 'ما قدرنا نولّد صور، جرب تاني' : 'Could not generate images, try again');
    } finally {
      setImgLoading(false);
    }
  };

  const downloadImage = (url: string, size: string, idx: number) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProduct?.nameAr || 'promo'}-${size}-${idx + 1}.png`;
    a.click();
  };

  const generateWaMessage = async () => {
    if (!waPrompt.trim() || !currentStore) return;
    setWaLoading(true);
    setWaError('');
    try {
      const res = await fetch('/api/enhance-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldType: 'whatsapp_broadcast',
          currentText: waPrompt,
          context: currentStore.name,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.suggestions?.length) throw new Error(data.error || 'failed');
      setWaMessage(data.suggestions[0]);
    } catch {
      setWaError(isAr ? 'ما قدرنا نولّد رسالة، جرب تاني.' : 'Could not generate a message, try again.');
    } finally {
      setWaLoading(false);
    }
  };

  const copyWaMessage = async () => {
    try {
      await navigator.clipboard.writeText(waMessage);
      setWaCopied(true);
      setTimeout(() => setWaCopied(false), 2500);
      toast({ title: isAr ? '✅ تم النسخ' : '✅ Copied' });
    } catch {
      toast({ title: isAr ? 'فشل النسخ' : 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-primary" />
          {isAr ? 'استوديو التسويق' : 'Marketing Studio'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr ? 'اضغط زر واحد، والذكاء الاصطناعي يجهزلك محتوى تسويقي جاهز للنشر' : 'One click, and AI prepares ready-to-post marketing content'}
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <label className="text-xs text-muted-foreground mb-2 block font-medium">
            {isAr ? 'اختر منتج' : 'Choose a product'}
          </label>
          {loadingProducts ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {isAr ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">{isAr ? 'ضيف منتج الأول عشان تقدر تستخدم الاستوديو' : 'Add a product first to use the studio'}</p>
          ) : (
            <div className="relative">
              <button
                onClick={() => setPickerOpen(v => !v)}
                className="w-full flex items-center gap-3 border border-border/50 rounded-lg p-2.5 hover:border-primary/40 transition-colors"
              >
                {selectedProduct?.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt="" className="w-10 h-10 rounded-md object-cover bg-muted" />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center"><ImageIcon className="w-4 h-4 text-muted-foreground/50" /></div>
                )}
                <div className="flex-1 text-start min-w-0">
                  <p className="text-sm font-medium truncate">{selectedProduct ? (isAr ? selectedProduct.nameAr : selectedProduct.nameEn) : ''}</p>
                  {selectedProduct && <p className="text-xs text-muted-foreground">{getCurrencySymbol(selectedProduct.currency)}{selectedProduct.price}</p>}
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
              </button>
              {pickerOpen && (
                <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-popover border border-border/50 rounded-lg shadow-lg">
                  {products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedId(p.id); setPickerOpen(false); }}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/50 transition-colors text-start"
                    >
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-9 h-9 rounded-md object-cover bg-muted" /> : <div className="w-9 h-9 rounded-md bg-muted" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{isAr ? p.nameAr : p.nameEn}</p>
                        <p className="text-xs text-muted-foreground">{getCurrencySymbol(p.currency)}{p.price}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {isAr ? 'منشور سوشال ميديا' : 'Social media post'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {captions.length === 0 && !captionsLoading && !captionsError && (
            <Button onClick={generateCaptions} disabled={!selectedProduct} className="w-full gap-2">
              <Sparkles className="w-4 h-4" />
              {isAr ? 'أنشئ منشور جاهز' : 'Generate a post'}
            </Button>
          )}
          {captionsLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> {isAr ? 'جاري التوليد...' : 'Generating...'}
            </div>
          )}
          {captionsError && (
            <div className="text-center py-2">
              <p className="text-sm text-red-400 mb-2">{captionsError}</p>
              <Button size="sm" variant="outline" onClick={generateCaptions}>{isAr ? 'حاول مرة ثانية' : 'Try again'}</Button>
            </div>
          )}
          {captions.length > 0 && (
            <>
              <div className="flex justify-end">
                <button onClick={generateCaptions} className="text-xs text-muted-foreground hover:text-foreground">
                  {isAr ? '↻ أعد التوليد' : '↻ Regenerate'}
                </button>
              </div>
              <div className="space-y-2">
                {captions.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border/40 bg-background/50 p-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 mb-2">{c}</p>
                    <button onClick={() => copyCaption(c, i)} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                      {copiedIdx === i
                        ? <><Check className="w-3.5 h-3.5" /> {isAr ? 'تم النسخ' : 'Copied'}</>
                        : <><Copy className="w-3.5 h-3.5" /> {isAr ? 'نسخ المنشور + الرابط' : 'Copy post + link'}</>}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            {isAr ? 'صور ترويجية بالذكاء الاصطناعي' : 'AI promotional images'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">{isAr ? 'وصف المشهد يلي بدك ياه (اختياري)' : 'Describe the scene you want (optional)'}</label>
            <Textarea
              value={imgPrompt}
              onChange={e => setImgPrompt(e.target.value)}
              rows={2}
              placeholder={isAr ? 'مثال: المنتج فوق طاولة خشبية بإضاءة دافئة وأجواء شتوية' : 'e.g. product on a wooden table with warm winter lighting'}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">{isAr ? 'المقاس' : 'Size'}</label>
            <div className="grid grid-cols-3 gap-2">
              {IMG_SIZES.map(s => {
                const Icon = s.icon;
                const on = imgSelectedSize === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setImgSelectedSize(s.key)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs transition-colors ${on ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:border-border'}`}
                  >
                    <Icon className="w-4 h-4" />
                    {isAr ? s.labelAr : s.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          <Button onClick={generateImages} disabled={!selectedProduct?.imageUrl || imgLoading} className="w-full gap-2">
            {imgLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isAr ? 'أنشئ الصورة' : 'Generate image'}
          </Button>
          {!selectedProduct?.imageUrl && (
            <p className="text-xs text-muted-foreground text-center">{isAr ? 'المنتج المختار بدون صورة' : 'Selected product has no image'}</p>
          )}
          {imgError && <p className="text-sm text-red-400 text-center">{imgError}</p>}
          {imgResults.length > 0 && !imgError && (
            <p className="text-xs text-muted-foreground text-center">{isAr ? 'بدك صورة كمان؟ غيّر المقاس أو الوصف واضغط "أنشئ الصورة" مرة ثانية' : 'Want another? Change the size or prompt and generate again'}</p>
          )}

          {imgResults.length > 0 && (
            <div className="space-y-4 pt-2">
              {imgResults.map(group => (
                <div key={group.size}>
                  <p className="text-xs text-muted-foreground font-medium mb-2">{IMG_SIZES.find(s => s.key === group.size)?.[isAr ? 'labelAr' : 'labelEn'] || group.size}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.urls.map((url, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-border/40">
                        <img src={url} alt="" className="w-full object-cover" style={{ aspectRatio: group.size.replace('x', '/') }} />
                        <button
                          onClick={() => downloadImage(url, group.size, i)}
                          className="absolute bottom-1.5 end-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            {isAr ? 'رسالة واتساب تسويقية' : 'WhatsApp marketing message'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <Textarea
            value={waPrompt}
            onChange={e => setWaPrompt(e.target.value)}
            rows={2}
            placeholder={isAr ? 'وش المناسبة أو العرض؟ مثال: خصم 20% على كل شي نهاية الأسبوع' : "What's the occasion or offer? e.g. 20% off everything this weekend"}
          />
          <Button onClick={generateWaMessage} disabled={!waPrompt.trim() || waLoading} className="w-full gap-2">
            {waLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isAr ? 'أنشئ الرسالة' : 'Generate message'}
          </Button>
          {waError && <p className="text-sm text-red-400 text-center">{waError}</p>}
          {waMessage && (
            <div className="rounded-lg border border-border/40 bg-background/50 p-3 space-y-2">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{waMessage}</p>
              <button onClick={copyWaMessage} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                {waCopied
                  ? <><Check className="w-3.5 h-3.5" /> {isAr ? 'تم النسخ' : 'Copied'}</>
                  : <><Copy className="w-3.5 h-3.5" /> {isAr ? 'نسخ الرسالة' : 'Copy message'}</>}
              </button>
              <p className="text-xs text-muted-foreground/70 pt-1 border-t border-border/30">
                {isAr ? 'الصق الرسالة بقائمة البث (Broadcast List) بواتساب عشان توصل لعملائك دفعة وحدة' : 'Paste into a WhatsApp Broadcast List to reach your customers at once'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
