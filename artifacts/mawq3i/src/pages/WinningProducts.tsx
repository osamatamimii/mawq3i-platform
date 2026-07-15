import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, TrendingUp, Users, Tag, ExternalLink, Search } from 'lucide-react';

type WinningProduct = {
  name_ar: string;
  name_en: string;
  why_trending: string;
  target_audience: string;
  price_range: string;
  source_hint: string;
};

export default function WinningProducts() {
  const { language, currentStore } = useAppContext();
  const isAr = language === 'ar';

  const [niche, setNiche] = useState('');
  const [market, setMarket] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ niche: string; market: string; products: WinningProduct[]; citations: { title: string; url: string }[] } | null>(null);

  const search = async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/product-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'winning_products',
          storeId: currentStore.id,
          niche: niche.trim(),
          market: market.trim(),
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Request failed');
      setResult(data);
    } catch (e: any) {
      setError(e?.message || (isAr ? 'حدث خطأ، حاول مرة ثانية' : 'Something went wrong, try again'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          {isAr ? 'المنتجات الرابحة' : 'Winning Products'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isAr ? 'الذكاء الاصطناعي يبحث بالويب عن منتجات رائجة تناسب نيتشك الآن' : 'AI searches the web for products trending now that fit your niche'}
        </p>
      </div>

      <Card className="bg-card border-border/50 shadow-lg">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isAr ? 'النيتش / التخصص (اختياري — نحدده تلقائيًا من منتجاتك)' : 'Niche (optional — auto-detected from your products)'}</Label>
              <Input value={niche} onChange={e => setNiche(e.target.value)} placeholder={isAr ? 'مثال: إكسسوارات نسائية' : 'e.g. women accessories'} className="bg-background/50 border-border/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isAr ? 'السوق المستهدف (اختياري)' : 'Target market (optional)'}</Label>
              <Input value={market} onChange={e => setMarket(e.target.value)} placeholder={isAr ? 'مثال: فلسطين والأردن' : 'e.g. Palestine and Jordan'} className="bg-background/50 border-border/50" />
            </div>
          </div>
          <Button onClick={search} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isAr ? 'ابحث عن منتجات رابحة' : 'Find winning products'}
          </Button>
          {loading && (
            <p className="text-xs text-muted-foreground">{isAr ? 'عم نبحث بالويب... قد ياخد 15-30 ثانية' : 'Searching the web... may take 15-30 seconds'}</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {isAr ? `النيتش: ${result.niche} — السوق: ${result.market}` : `Niche: ${result.niche} — Market: ${result.market}`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.products.map((p, i) => (
              <Card key={i} className="bg-card border-border/50 shadow-lg">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{isAr ? p.name_ar : (p.name_en || p.name_ar)}</h3>
                    <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
                  </div>
                  {isAr && p.name_en && <p className="text-[11px] text-muted-foreground" dir="ltr">{p.name_en}</p>}
                  <p className="text-xs text-muted-foreground">{p.why_trending}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    <span>{p.target_audience}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-primary">
                    <Tag className="w-3 h-3" />
                    <span>{p.price_range}</span>
                  </div>
                  {p.source_hint && (
                    <p className="text-[10px] text-muted-foreground/70 pt-1 border-t border-border/30">
                      {isAr ? 'المصدر: ' : 'Source: '}{p.source_hint}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {result.citations?.length > 0 && (
            <Card className="bg-card border-border/50">
              <CardContent className="p-3 space-y-1">
                <p className="text-xs text-muted-foreground mb-1">{isAr ? 'روابط استند عليها البحث:' : 'Sources referenced:'}</p>
                {result.citations.slice(0, 6).map((c, i) => (
                  <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-primary/80 hover:text-primary truncate">
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{c.title || c.url}</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </motion.div>
  );
}
