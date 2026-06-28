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

    // ── helpers ────────────────────────────────────────────────────────────
    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function wrapText(text: string, maxW: number, fontStr: string): string[] {
      ctx.font = fontStr;
      const words = text.split(' ');
      let line = '';
      const result: string[] = [];
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          result.push(line);
          line = w;
        } else { line = test; }
      }
      if (line) result.push(line);
      return result;
    }

    // ── 1. BACKGROUND: solid dark ──────────────────────────────────────────
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, W, H);

    // subtle grain texture (noise overlay)
    const grainCanvas = document.createElement('canvas');
    grainCanvas.width = 200; grainCanvas.height = 200;
    const gctx = grainCanvas.getContext('2d')!;
    const imageData = gctx.createImageData(200, 200);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 255;
      imageData.data[i] = v; imageData.data[i+1] = v;
      imageData.data[i+2] = v; imageData.data[i+3] = 8;
    }
    gctx.putImageData(imageData, 0, 0);
    const grainPat = ctx.createPattern(grainCanvas, 'repeat')!;
    ctx.fillStyle = grainPat;
    ctx.fillRect(0, 0, W, H);

    // ── 2. NAV BAR (simulating the store nav) ────────────────────────────
    // Frosted pill nav like the real site
    const navH = 110, navY = 80, navPad = 60;
    ctx.save();
    roundRect(navPad, navY, W - navPad * 2, navH, navH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Store name in nav (right side for RTL)
    ctx.fillStyle = '#f0ede8';
    ctx.font = 'bold 46px serif';
    ctx.textAlign = 'right';
    ctx.fillText(storeName, W - navPad - 50, navY + navH * 0.64);

    // "← المتجر" back button (left side)
    ctx.fillStyle = 'rgba(240,237,232,0.55)';
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('← المتجر', navPad + 44, navY + navH * 0.64);

    // ── 3. PRODUCT IMAGE (portrait, fills top half) ───────────────────────
    const imgPad = 60;
    const imgX = imgPad, imgY = navY + navH + 60;
    const imgW = W - imgPad * 2;
    const imgH = Math.round(imgW * 1.18); // slightly portrait

    ctx.save();
    roundRect(imgX, imgY, imgW, imgH, 48);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    ctx.clip();

    if (product.imageUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const scale = Math.max(imgW / img.width, imgH / img.height);
          const sw = img.width * scale, sh = img.height * scale;
          const sx = imgX + (imgW - sw) / 2, sy = imgY + (imgH - sh) / 2;
          ctx.drawImage(img, sx, sy, sw, sh);
          resolve();
        };
        img.onerror = () => { resolve(); };
        img.src = product.imageUrl!;
      });
    }

    // gradient overlay at bottom of image (fade to black)
    const fadeGrad = ctx.createLinearGradient(0, imgY + imgH * 0.55, 0, imgY + imgH);
    fadeGrad.addColorStop(0, 'transparent');
    fadeGrad.addColorStop(1, 'rgba(12,12,12,0.85)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(imgX, imgY, imgW, imgH);
    ctx.restore();

    // badge (if any)
    if (product.badge) {
      ctx.save();
      const badgeText = product.badge;
      ctx.font = 'bold 34px sans-serif';
      const bw = ctx.measureText(badgeText).width + 48;
      roundRect(W - imgPad - bw - 24, imgY + 28, bw, 58, 29);
      ctx.fillStyle = primaryColor;
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, W - imgPad - bw / 2 - 24, imgY + 28 + 38);
      ctx.restore();
    }

    // ── 4. INFO SECTION ───────────────────────────────────────────────────
    const infoY = imgY + imgH + 64;
    const infoPad = 70;

    // Store tag (small caps)
    ctx.fillStyle = 'rgba(240,237,232,0.45)';
    ctx.font = '500 34px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(storeName.toUpperCase(), W - infoPad, infoY);

    // Product name (Bodoni-like serif, large)
    const nameLines = wrapText(productName, W - infoPad * 2, 'bold 88px serif');
    ctx.fillStyle = '#f0ede8';
    ctx.textAlign = 'right';
    let nameYCur = infoY + 96;
    for (const l of nameLines) {
      ctx.font = 'bold 88px serif';
      ctx.fillText(l, W - infoPad, nameYCur);
      nameYCur += 104;
    }

    // Description (short, faded)
    const descText = product.descAr || product.descEn || '';
    if (descText) {
      const descLines = wrapText(descText, W - infoPad * 2, '300 38px sans-serif').slice(0, 2);
      ctx.fillStyle = 'rgba(240,237,232,0.45)';
      ctx.font = '300 38px sans-serif';
      let descY = nameYCur + 12;
      for (const l of descLines) { ctx.fillText(l, W - infoPad, descY); descY += 52; }
      nameYCur = descY + 20;
    }

    // Price row
    const priceText = price;
    ctx.font = 'bold 110px serif';
    ctx.fillStyle = '#f0ede8';
    ctx.textAlign = 'right';
    ctx.fillText(priceText, W - infoPad, nameYCur + 100);

    // ── 5. BUTTONS ────────────────────────────────────────────────────────
    const btnY = nameYCur + 180;
    const btnH = 118, btnR = btnH / 2;
    const btnW = W - infoPad * 2;

    // Primary: WhatsApp / Order now (accent color)
    ctx.save();
    roundRect(infoPad, btnY, btnW, btnH, btnR);
    ctx.fillStyle = primaryColor;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#000';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isAr ? 'اطلب الآن عبر واتساب' : 'Order via WhatsApp', W / 2, btnY + btnH * 0.62);

    // Secondary: browse store
    const btn2Y = btnY + btnH + 28;
    ctx.save();
    roundRect(infoPad, btn2Y, btnW, btnH, btnR);
    ctx.strokeStyle = 'rgba(240,237,232,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(240,237,232,0.75)';
    ctx.font = '400 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isAr ? 'تصفح المتجر كاملاً' : 'Browse Store', W / 2, btn2Y + btnH * 0.62);

    // ── 6. BOTTOM DOMAIN ─────────────────────────────────────────────────
    const storeUrl = store.domain ? store.domain : `${store.slug}.mawq3i.co`;
    ctx.fillStyle = primaryColor + 'bb';
    ctx.font = '400 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(storeUrl, W / 2, H - 72);

    // thin accent line at very bottom
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, H - 8, W, 8);

    // Convert
    canvas.toBlob((blob) => {
      if (blob) { storyBlobRef.current = blob; setStoryReady(true); }
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
