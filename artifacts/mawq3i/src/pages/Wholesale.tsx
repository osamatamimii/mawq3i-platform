import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { Product } from '@/data/mockData';
import { getProducts } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Boxes, Pencil, Loader2, Package } from 'lucide-react';

export default function Wholesale() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const [, setLocation] = useLocation();
  const isAr = language === 'ar';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts(currentStore?.id, isAdminMode).then(data => {
      setProducts(data);
      setLoading(false);
    });
  }, [currentStore?.id]);

  const wholesaleProducts = products.filter(
    p => (p.wholesaleTiers && p.wholesaleTiers.length > 0) || (p.moq && p.moq > 1)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Boxes className="w-5 h-5 text-primary" />
            {isAr ? 'الجملة' : 'Wholesale'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr
              ? 'المنتجات اللي عليها أسعار جملة أو حد أدنى للطلب — تقدر تضيف/تعدّل من صفحة كل منتج.'
              : 'Products with tiered pricing or a minimum order quantity — add or edit from each product page.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => setLocation('/dashboard/products')} data-testid="button-go-products">
          <Package className="w-4 h-4 me-1.5" />
          {isAr ? 'كل المنتجات' : 'All products'}
        </Button>
      </div>

      {wholesaleProducts.length === 0 ? (
        <Card className="bg-card border-border/50 shadow-lg">
          <CardContent className="py-16 text-center space-y-3">
            <Boxes className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="font-medium">{isAr ? 'ما في منتجات عليها أسعار جملة لسا' : 'No wholesale products yet'}</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {isAr
                ? 'افتح أي منتج وأضف "أسعار الجملة" أو "الحد الأدنى للطلب" من قسم أسعار الجملة بصفحة تعديل المنتج.'
                : 'Open any product and add wholesale price tiers or a minimum order quantity from the wholesale section on its edit page.'}
            </p>
            <Button onClick={() => setLocation('/dashboard/products')} data-testid="button-empty-go-products">
              {isAr ? 'روح لصفحة المنتجات' : 'Go to products'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {wholesaleProducts.map((product, i) => (
            <motion.div key={product.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="bg-card border-border/50 shadow-lg" data-testid={`card-wholesale-${product.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{isAr ? product.nameAr : product.nameEn}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {product.moq && product.moq > 1 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-muted text-muted-foreground font-mono">
                          {isAr ? `MOQ: ${product.moq}` : `MOQ: ${product.moq}`}
                        </span>
                      ) : null}
                      {(product.wholesaleTiers || [])
                        .slice()
                        .sort((a, b) => a.minQty - b.minQty)
                        .map((t, ti) => (
                          <span
                            key={ti}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-primary/10 text-primary font-mono"
                          >
                            {t.minQty}+ = {t.price} {product.currency === 'ILS' ? '₪' : '﷼'}
                          </span>
                        ))}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-border/50 hover:border-primary/30 shrink-0"
                    onClick={() => setLocation(`/dashboard/products/edit/${product.id}`)}
                    data-testid={`button-edit-wholesale-${product.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
