import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Product } from '@/data/mockData';
import { getProducts } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, ExternalLink, Scale } from 'lucide-react';

type Competitor = { store_name: string; price: number; currency: string; url?: string; note?: string };

export default function CompetitorPrices() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [myPrice, setMyPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ productName: string; competitors: Competitor[]; summary: string; citations: { title: string; url: string }[] } | null>(null);

  useEffect(() => {
    if (!currentStore?.id) return;
    getProducts(currentStore.id, isAdminMode).then(setProducts);
  }, [currentStore?.id]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const onSelectProduct = (id: string) => {
    setSelectedProductId(id);
    const p = products.find(x => x.id === id);
    if (p) {
      setCustomName('');
      setMyPrice(String(p.price));
    }
  };

  const search = async () => {
    if (!currentStore?.id) return;
    const productName = customName.trim() || (selectedProduct ? (selectedProduct.nameAr || selectedProduct.nameEn) : '');
    if (!productName) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/product-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'competitor_prices',
          storeId: currentStore.id,
          productName,
          myPrice: myPrice ? Number(myPrice) : undefined,
          currency: selectedProduct?.currency || currentStore.currency || 'ILS',
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

  const currencySymbol = (c: string) => (c === 'SAR' ? '﷼' : '₪');

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          {isAr ? 'مراقبة أسعار المنافسين' : 'Competitor Price Watch'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isAr ? 'الذكاء الاصطناعي يبحث بالويب عن أسعار نفس المنتج عند منافسين آخرين' : 'AI searches the web for this product\'s price at other retailers'}
        </p>
      </div>

      <Card className="bg-card border-border/50 shadow-lg">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isAr ? 'اختر منتج من متجرك' : 'Pick a product from your store'}</Label>
            <Select value={selectedProductId} onValueChange={onSelectProduct}>
              <SelectTrigger className="bg-background/50 border-border/50">
                <SelectValue placeholder={isAr ? 'اختر منتج...' : 'Select a product...'} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-64">
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nameAr || p.nameEn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground text-center">{isAr ? 'أو' : 'or'}</p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isAr ? 'اكتب اسم منتج يدويًا' : 'Type a product name manually'}</Label>
            <Input
              value={customName}
              onChange={e => { setCustomName(e.target.value); setSelectedProductId(''); }}
              placeholder={isAr ? 'مثال: سماعة بلوتوث لاسلكية' : 'e.g. wireless bluetooth earbuds'}
              className="bg-background/50 border-border/50"
            />
          </div>
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs text-muted-foreground">{isAr ? 'سعرك الحالي (اختياري)' : 'Your current price (optional)'}</Label>
            <Input type="number" value={myPrice} onChange={e => setMyPrice(e.target.value)} className="bg-background/50 border-border/50 font-mono" />
          </div>
          <Button onClick={search} disabled={loading || (!customName.trim() && !selectedProductId)} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isAr ? 'قارن الأسعار' : 'Compare prices'}
          </Button>
          {loading && (
            <p className="text-xs text-muted-foreground">{isAr ? 'عم نبحث بالويب... قد ياخد 15-30 ثانية' : 'Searching the web... may take 15-30 seconds'}</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-3">
          <Card className="bg-card border-border/50 shadow-lg">
            <CardContent className="p-0">
              {result.competitors.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {isAr ? 'ما لقينا نتائج كافية لهذا المنتج، جرب اسم أوضح أو أعم' : 'Not enough results found — try a clearer or more general name'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-xs text-muted-foreground">
                        <th className="text-start px-4 py-2.5 font-medium">{isAr ? 'المتجر' : 'Store'}</th>
                        <th className="text-start px-4 py-2.5 font-medium">{isAr ? 'السعر' : 'Price'}</th>
                        <th className="text-start px-4 py-2.5 font-medium">{isAr ? 'ملاحظة' : 'Note'}</th>
                        <th className="text-start px-4 py-2.5 font-medium">{isAr ? 'المصدر' : 'Source'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.competitors.map((c, i) => {
                        const diff = myPrice ? c.price - Number(myPrice) : null;
                        return (
                          <tr key={i} className="border-b border-border/30 last:border-0">
                            <td className="px-4 py-2.5">{c.store_name}</td>
                            <td className="px-4 py-2.5 font-mono">
                              {c.price} {currencySymbol(c.currency)}
                              {diff !== null && (
                                <span className={`ms-2 text-[11px] ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                  ({diff > 0 ? '+' : ''}{diff.toFixed(0)})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.note || '—'}</td>
                            <td className="px-4 py-2.5">
                              {c.url ? (
                                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary/80 hover:text-primary">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          {result.summary && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 text-sm">{result.summary}</CardContent>
            </Card>
          )}
        </div>
      )}
    </motion.div>
  );
}
