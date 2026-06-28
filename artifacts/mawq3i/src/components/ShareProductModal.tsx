import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, ChevronRight, Download, Share2,
  MessageCircle, Facebook, Send, Instagram, X, Sparkles
} from 'lucide-react';
import type { Product } from '@/data/mockData';
import type { StoreRecord } from '@/data/mockData';

// ── Types ──────────────────────────────────────────────────────────────────
interface ShareProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  store: StoreRecord;
  language: 'ar' | 'en';
}

type ShareView = 'main' | 'story';

// ── Helpers ────────────────────────────────────────────────────────────────
function getProductUrl(product: Product, store: StoreRecord): string {
  const base = store.domain
    ? `https://${store.domain}`
    : `https://${store.slug}.mawq3i.co`;
  return `${base}/product?id=${product.id}`;
}

function getCurrencySymbol(currency: string): string {
  return currency === 'SAR' ? '﷼' : '₪';
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ShareProductModal({
  open, onOpenChange, product, store, language
}: ShareProductModalProps) {
  const isAr = language === 'ar';
  const { toast } = useToast();
  const [view, setView] = useState<ShareView>('main');
  const [copied, setCopied] = useState(false);
  const [storyReady, setStoryReady] = useState(false);
  const [storyGenerating, setStoryGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storyBlobRef = useRef<Blob | null>(null);

  const productUrl = getProductUrl(product, store);
  const productName = isAr ? product.nameAr : product.nameEn;
  const price = `${getCurrencySymbol(product.currency || 'ILS')}${product.price}`;
  const storeName = store.name;
  const primaryColor = store.primaryColor || '#52FF3F';

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setView('main');
      setCopied(false);
      setStoryReady(false);
      storyBlobRef.current = null;
    }
  }, [open]);

  // ── Copy Link ───────────────────────────────────────────────────────────
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast({ title: isAr ? '✅ تم نسخ الرابط' : '✅ Link copied' });
    } catch {
      toast({ title: isAr ? 'فشل النسخ' : 'Copy failed', variant: 'destructive' });
    }
  };

  // ── Share Targets ───────────────────────────────────────────────────────
  const shareTargets = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageCircle className="w-5 h-5" />,
      color: '#25D366',
      bg: 'rgba(37,211,102,0.12)',
      action: () => {
        const text = isAr
          ? `🛍️ *${productName}*\n💰 السعر: ${price}\n🏪 ${storeName}\n\n${productUrl}`
          : `🛍️ *${productName}*\n💰 Price: ${price}\n🏪 ${storeName}\n\n${productUrl}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
    },
    {
      key: 'facebook',
      label: 'Facebook',
      icon: <Facebook className="w-5 h-5" />,
      color: '#1877F2',
      bg: 'rgba(24,119,242,0.12)',
      action: () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`, '_blank');
      }
    },
    {
      key: 'telegram',
      label: 'Telegram',
      icon: <Send className="w-5 h-5" />,
      color: '#0088CC',
      bg: 'rgba(0,136,204,0.12)',
      action: () => {
        const text = isAr ? `🛍️ ${productName} — ${price}` : `🛍️ ${productName} — ${price}`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(productUrl)}&text=${encodeURIComponent(text)}`, '_blank');
      }
    },
    {
      key: 'instagram',
      label: isAr ? 'Instagram Story' : 'Instagram Story',
      icon: <Instagram className="w-5 h-5" />,
      color: '#E1306C',
      bg: 'rgba(225,48,108,0.12)',
      action: () => setView('story')
    },
  ];

  // ── Story Generator ──────────────────────────────────────────────────────
  const generateStory = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStoryGenerating(true);
    setStoryReady(false);

    const W = 1080, H = 1920;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0a0a0a');
    bgGrad.addColorStop(0.5, '#111111');
    bgGrad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Glow circle background
    const glowGrad = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, 480);
    glowGrad.addColorStop(0, primaryColor + '22');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, H);

    // Decorative top bar
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, W, 8);

    // Store name top
    ctx.fillStyle = primaryColor;
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(storeName, W / 2, 110);

    // Separator line
    ctx.strokeStyle = primaryColor + '44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 200, 140);
    ctx.lineTo(W / 2 + 200, 140);
    ctx.stroke();

    // Product image area — rounded rect
    const imgX = W / 2 - 380, imgY = 180, imgW = 760, imgH = 760;
    const r = 48;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imgX + r, imgY);
    ctx.lineTo(imgX + imgW - r, imgY);
    ctx.quadraticCurveTo(imgX + imgW, imgY, imgX + imgW, imgY + r);
    ctx.lineTo(imgX + imgW, imgY + imgH - r);
    ctx.quadraticCurveTo(imgX + imgW, imgY + imgH, imgX + imgW - r, imgY + imgH);
    ctx.lineTo(imgX + r, imgY + imgH);
    ctx.quadraticCurveTo(imgX, imgY + imgH, imgX, imgY + imgH - r);
    ctx.lineTo(imgX, imgY + r);
    ctx.quadraticCurveTo(imgX, imgY, imgX + r, imgY);
    ctx.closePath();

    // Image shadow
    ctx.shadowColor = primaryColor + '40';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    ctx.clip();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Load product image
    if (product.imageUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          // Object-fit: cover
          const scale = Math.max(imgW / img.width, imgH / img.height);
          const sw = img.width * scale, sh = img.height * scale;
          const sx = imgX + (imgW - sw) / 2, sy = imgY + (imgH - sh) / 2;
          ctx.drawImage(img, sx, sy, sw, sh);
          resolve();
        };
        img.onerror = () => {
          // Fallback emoji
          ctx.font = '200px serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#333';
          ctx.fillText('📦', W / 2, imgY + imgH / 2 + 60);
          resolve();
        };
        img.src = product.imageUrl!;
      });
    } else {
      ctx.font = '200px serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#222';
      ctx.fillText('📦', W / 2, imgY + imgH / 2 + 60);
    }
    ctx.restore();

    // Product name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 20;
    // Wrap long names
    const maxWidth = W - 120;
    const words = productName.split(' ');
    let line = '', lines: string[] = [];
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
    const nameY = imgY + imgH + 90;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, nameY + i * 95));

    ctx.shadowBlur = 0;

    // Price badge
    const priceY = nameY + lines.length * 95 + 40;
    const priceText = price;
    ctx.font = 'bold 100px Arial';
    const priceW = ctx.measureText(priceText).width;
    const padX = 70, padY = 35;
    const bx = W / 2 - priceW / 2 - padX, by = priceY - 75;
    const bw = priceW + padX * 2, bh = 80 + padY * 2;

    // Badge background
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 24);
    ctx.fill();

    // Price text
    ctx.fillStyle = '#000';
    ctx.fillText(priceText, W / 2, priceY + 10);

    // CTA button
    const ctaY = priceY + 150;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 300, ctaY - 55, 600, 110, 55);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(isAr ? '🛒 اطلب الآن' : '🛒 Order Now', W / 2, ctaY + 18);

    // Bottom: store URL hint
    ctx.fillStyle = primaryColor + 'aa';
    ctx.font = '38px Arial';
    ctx.fillText(`${store.slug}.mawq3i.co`, W / 2, H - 80);

    // Bottom bar
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, H - 8, W, 8);

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        storyBlobRef.current = blob;
        setStoryReady(true);
      }
      setStoryGenerating(false);
    }, 'image/png', 0.95);
  }, [product, store, productName, price, primaryColor, storeName, isAr]);

  useEffect(() => {
    if (view === 'story' && !storyReady && !storyGenerating) {
      generateStory();
    }
  }, [view, storyReady, storyGenerating, generateStory]);

  const downloadStory = () => {
    if (!storyBlobRef.current) return;
    const url = URL.createObjectURL(storyBlobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${product.nameAr || product.nameEn}-story.png`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: isAr ? '✅ تم تحميل الـ Story' : '✅ Story downloaded' });
  };

  const shareStory = async () => {
    if (!storyBlobRef.current) return;
    try {
      const file = new File([storyBlobRef.current], 'story.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: productName, text: productUrl });
      } else {
        downloadStory();
      }
    } catch {
      downloadStory();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/50 sm:max-w-md p-0 overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
        {/* Hidden canvas for story generation */}
        <canvas ref={canvasRef} className="hidden" />

        <AnimatePresence mode="wait">
          {view === 'main' && (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isAr ? 40 : -40 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader className="px-6 pt-6 pb-4">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Share2 className="w-4 h-4 text-primary" />
                  {isAr ? 'مشاركة المنتج' : 'Share Product'}
                </DialogTitle>
                {/* Product preview */}
                <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-muted/40 border border-border/30">
                  <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{productName}</p>
                    <p className="text-primary text-sm font-mono font-bold">{price}</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 pb-3 space-y-2">
                {/* Share platforms */}
                <p className="text-xs text-muted-foreground mb-3 font-medium">
                  {isAr ? 'شارك عبر' : 'Share via'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {shareTargets.map((t) => (
                    <motion.button
                      key={t.key}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={t.action}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 hover:border-border/80 transition-all text-sm font-medium group"
                      style={{ background: t.bg }}
                    >
                      <span style={{ color: t.color }}>{t.icon}</span>
                      <span className="flex-1 text-start">{t.label}</span>
                      {t.key === 'instagram' && (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Copy link */}
              <div className="px-6 pb-6 pt-2">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground flex-1 truncate font-mono" dir="ltr">
                    {productUrl}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 h-8 gap-1.5 text-xs border-border/50 hover:border-primary/40"
                    onClick={copyLink}
                  >
                    {copied
                      ? <><Check className="w-3.5 h-3.5 text-green-400" /> {isAr ? 'تم' : 'Copied'}</>
                      : <><Copy className="w-3.5 h-3.5" /> {isAr ? 'نسخ' : 'Copy'}</>
                    }
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground/60 mt-2 text-center">
                  {isAr
                    ? '* يظهر Preview احترافي عند المشاركة على واتساب وتيليجرام'
                    : '* Professional preview appears on WhatsApp & Telegram shares'}
                </p>
              </div>
            </motion.div>
          )}

          {view === 'story' && (
            <motion.div
              key="story"
              initial={{ opacity: 0, x: isAr ? -40 : 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setView('main')}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className={`w-4 h-4 ${isAr ? '' : 'rotate-180'}`} />
                  </button>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="w-4 h-4 text-primary" />
                    {isAr ? 'Story إنستقرام' : 'Instagram Story'}
                  </DialogTitle>
                </div>
              </DialogHeader>

              <div className="px-6 pb-6 space-y-4">
                {/* Story preview */}
                <div className="relative flex justify-center">
                  {storyGenerating && (
                    <div className="w-48 h-[340px] rounded-2xl bg-muted/40 border border-border/30 flex flex-col items-center justify-center gap-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                      >
                        <Sparkles className="w-8 h-8 text-primary" />
                      </motion.div>
                      <p className="text-xs text-muted-foreground">
                        {isAr ? 'جاري التوليد...' : 'Generating...'}
                      </p>
                    </div>
                  )}
                  {storyReady && canvasRef.current && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative"
                    >
                      <img
                        src={canvasRef.current.toDataURL()}
                        alt="story preview"
                        className="w-48 rounded-2xl shadow-2xl shadow-black/40 border border-white/10"
                        style={{ aspectRatio: '9/16' }}
                      />
                      {/* Overlay badge */}
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                        <Instagram className="w-3 h-3 text-pink-400" />
                        <span className="text-xs text-white">9:16</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {storyReady && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <Button
                      className="w-full gap-2"
                      onClick={shareStory}
                    >
                      <Share2 className="w-4 h-4" />
                      {isAr ? 'مشاركة مباشرة' : 'Share Directly'}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-border/50"
                      onClick={downloadStory}
                    >
                      <Download className="w-4 h-4" />
                      {isAr ? 'تحميل الصورة' : 'Download Image'}
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full gap-2 text-muted-foreground text-xs"
                      onClick={generateStory}
                      disabled={storyGenerating}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isAr ? 'إعادة التوليد' : 'Regenerate'}
                    </Button>
                  </motion.div>
                )}

                <p className="text-xs text-center text-muted-foreground/60">
                  {isAr
                    ? 'الصورة بجودة 1080×1920 جاهزة للنشر على إنستقرام'
                    : 'Image at 1080×1920 ready to post on Instagram'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
