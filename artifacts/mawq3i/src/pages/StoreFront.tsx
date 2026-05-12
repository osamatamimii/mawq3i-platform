import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { StoreRecord, Product } from '@/data/mockData';
import { getProducts, createOrder, getStoreBySlug, getStoreByDomain } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageCircle, ArrowLeft, Loader2, CheckCircle2, X } from 'lucide-react';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

type OrderState = 'idle' | 'form' | 'saving' | 'done';

export default function StoreFront() {
  const [, params] = useRoute('/store/:slug');
  const slug = params?.slug ?? '';
  const { language } = useAppContext();
  const isAr = language === 'ar';

  const [store, setStore] = useState<StoreRecord | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderState, setOrderState] = useState<OrderState>('idle');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [completedOrderId, setCompletedOrderId] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const hostname = window.location.hostname;
    const isCustomDomain =
      hostname !== 'localhost' &&
      !hostname.includes('.replit.dev') &&
      !hostname.includes('.replit.app') &&
      hostname !== 'mawq3i.co' &&
      !hostname.endsWith('.mawq3i.co');

    const resolveStore = isCustomDomain
      ? getStoreByDomain(hostname)
      : slug
        ? getStoreBySlug(slug)
        : Promise.resolve(null);

    setStoreLoading(true);
    resolveStore.then(s => {
      setStore(s);
      setStoreLoading(false);
      if (s) {
        getProducts(s.id).then(data => {
          setProducts(data.filter(p => p.status === 'visible'));
          setLoadingProducts(false);
        });
      } else {
        setLoadingProducts(false);
      }
    });
  }, [slug]);

  function openOrderDialog(product: Product) {
    setSelectedProduct(product);
    setCustomerName('');
    setCustomerPhone('');
    setFormError('');
    setOrderState('form');
  }

  function closeDialog() {
    setOrderState('idle');
    setSelectedProduct(null);
  }

  async function handleSubmitOrder() {
    if (!selectedProduct || !store) return;
    if (!customerName.trim()) {
      setFormError(isAr ? 'يرجى إدخال اسمك' : 'Please enter your name');
      return;
    }
    if (!customerPhone.trim()) {
      setFormError(isAr ? 'يرجى إدخال رقم هاتفك' : 'Please enter your phone number');
      return;
    }

    setFormError('');
    setOrderState('saving');

    const saved = await createOrder({
      storeId: store.id,
      productId: selectedProduct.id,
      productName: isAr ? selectedProduct.nameAr : selectedProduct.nameEn,
      customerName: customerName.trim(),
      phone: customerPhone.trim(),
      amount: selectedProduct.price,
      currency: selectedProduct.currency,
    });

    const orderId = saved?.id ?? `ORD-${Date.now().toString(36).toUpperCase()}`;
    setCompletedOrderId(orderId);
    setOrderState('done');

    const msg = `طلب جديد 🛍️%0aالمنتج: ${selectedProduct.nameAr}%0aالعميل: ${customerName}%0aالهاتف: ${customerPhone}%0aالمبلغ: ${selectedProduct.price} ${selectedProduct.currency}`;
    window.open(`https://wa.me/${store.ownerPhone.replace(/\D/g, '')}?text=${msg}`, '_blank');
  }

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <span className="text-6xl">🏪</span>
        <h1 className="text-2xl font-bold text-white">{isAr ? 'المتجر غير موجود' : 'Store not found'}</h1>
        <p className="text-sm">{isAr ? 'تحقق من الرابط وحاول مجدداً' : 'Check the URL and try again'}</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          {isAr ? 'عودة' : 'Go back'}
        </Button>
      </div>
    );
  }

  const accentColor = store.primaryColor ?? '#52FF3F';

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'} style={{ '--primary': accentColor } as React.CSSProperties}>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {store.logoUrl ? (
              <img src={store.logoUrl} alt={store.name} className="w-8 h-8 object-contain rounded" />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                {store.name.charAt(0)}
              </div>
            )}
            <span className="text-lg font-bold">{store.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => window.history.back()}>
              <ArrowLeft className="w-3.5 h-3.5 me-1" />
              {isAr ? 'عودة' : 'Back'}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              style={{ backgroundColor: accentColor, color: '#000' }}
              onClick={() => {
                const phone = (store.ownerPhone ?? '').replace(/\D/g, '');
                if (phone) window.open(`https://wa.me/${phone}`, '_blank');
              }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {isAr ? 'تواصل معنا' : 'Contact Us'}
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[130px]" style={{ backgroundColor: `${accentColor}14` }} />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium mb-6" style={{ borderColor: `${accentColor}40`, backgroundColor: `${accentColor}14`, color: accentColor }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
              {store.name}
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 leading-tight">
              {isAr ? 'تسوق معنا' : 'Shop With Us'}
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10">
              {store.description
                ? store.description
                : isAr ? 'منتجات أصيلة وفاخرة تصل إليك بكل سهولة وسرعة' : 'Premium authentic products delivered to your door'}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <motion.div className="mb-10" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <h2 className="text-2xl font-bold">{isAr ? 'منتجاتنا' : 'Our Products'}</h2>
          <p className="text-muted-foreground mt-1">{isAr ? 'اكتشف مجموعتنا المميزة' : 'Discover our curated collection'}</p>
        </motion.div>

        {loadingProducts ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <span className="text-5xl">📦</span>
            <p className="text-lg font-medium">{isAr ? 'لا توجد منتجات بعد' : 'No products yet'}</p>
            <p className="text-sm opacity-60">{isAr ? 'تابعنا قريباً لاكتشاف منتجاتنا' : 'Stay tuned for our upcoming products'}</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            {products.map((product) => (
              <motion.div
                key={product.id}
                variants={cardVariants}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group bg-card border border-border/50 rounded-2xl overflow-hidden transition-colors cursor-pointer shadow-lg"
                style={{ ['--hover-border' as any]: `${accentColor}40` }}
              >
                <div className="aspect-square bg-gradient-to-br from-muted to-background flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.nameAr} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: `${accentColor}14` }}>
                      <span className="text-2xl">{['🕌','🌿','💎','☕','🫐','🪔','✨','💍'][parseInt(product.id) % 8] ?? '📦'}</span>
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-1">{isAr ? product.nameAr : product.nameEn}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold font-mono" style={{ color: accentColor }}>
                      {product.currency === 'ILS' ? '₪' : '﷼'}{product.price}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {product.stock <= 5 && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {isAr ? `${product.stock} متبقي` : `${product.stock} left`}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">{product.currency}</span>
                    </div>
                  </div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      className="w-full h-9 text-xs gap-1.5 text-black font-semibold"
                      style={{ backgroundColor: accentColor }}
                      onClick={() => openOrderDialog(product)}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {isAr ? 'اطلب عبر واتساب' : 'Order via WhatsApp'}
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            {store.logoUrl && <img src={store.logoUrl} alt="" className="w-5 h-5 object-contain opacity-60" />}
            <span className="font-semibold text-sm">{store.name}</span>
          </div>
          <p>{isAr ? 'مدعوم بواسطة موقعي' : 'Powered by Mawq3i'}</p>
        </div>
      </footer>

      <AnimatePresence>
        {orderState !== 'idle' && selectedProduct && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget && orderState !== 'saving') closeDialog(); }}
          >
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.25 }}
              className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              {orderState === 'done' ? (
                <div className="p-8 text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto border"
                    style={{ backgroundColor: `${accentColor}20`, borderColor: `${accentColor}40` }}
                  >
                    <CheckCircle2 className="w-8 h-8" style={{ color: accentColor }} />
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{isAr ? 'تم تسجيل طلبك!' : 'Order Placed!'}</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      {isAr ? 'رقم طلبك' : 'Your order ID'}:
                      <span className="font-mono font-bold ms-1" style={{ color: accentColor }}>{completedOrderId}</span>
                    </p>
                    <p className="text-muted-foreground text-xs mt-2">
                      {isAr ? 'تم فتح واتساب مع تفاصيل طلبك. سيتواصل معك صاحب المتجر قريباً.' : 'WhatsApp opened with your order details. The store owner will contact you soon.'}
                    </p>
                  </div>
                  <Button className="w-full text-black font-semibold" style={{ backgroundColor: accentColor }} onClick={closeDialog}>
                    {isAr ? 'حسناً' : 'Done'}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                    <div>
                      <h3 className="font-bold text-white">{isAr ? 'إتمام الطلب' : 'Complete Order'}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{isAr ? selectedProduct.nameAr : selectedProduct.nameEn}</p>
                    </div>
                    <button onClick={closeDialog} disabled={orderState === 'saving'} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mx-6 mt-4 p-3 rounded-xl bg-muted/50 border border-border/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: `${accentColor}14` }}>
                      {selectedProduct.imageUrl
                        ? <img src={selectedProduct.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                        : ((['🕌','🌿','💎','☕','🫐','🪔','✨','💍'][parseInt(selectedProduct.id) % 8] ?? '📦'))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{isAr ? selectedProduct.nameAr : selectedProduct.nameEn}</p>
                      <p className="text-xs text-muted-foreground">{selectedProduct.category}</p>
                    </div>
                    <span className="font-bold font-mono text-sm flex-shrink-0" style={{ color: accentColor }}>
                      {selectedProduct.currency === 'ILS' ? '₪' : '﷼'}{selectedProduct.price}
                    </span>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">{isAr ? 'اسمك الكريم *' : 'Your Name *'}</Label>
                      <Input placeholder={isAr ? 'مثال: أحمد محمد' : 'e.g. John Smith'} value={customerName} onChange={e => setCustomerName(e.target.value)} disabled={orderState === 'saving'} className="bg-muted/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{isAr ? 'رقم هاتفك *' : 'Phone Number *'}</Label>
                      <Input placeholder={isAr ? 'مثال: 0591234567' : 'e.g. +1234567890'} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} disabled={orderState === 'saving'} className="bg-muted/50" dir="ltr" type="tel" />
                    </div>
                    {formError && <p className="text-red-400 text-xs">{formError}</p>}
                    <Button className="w-full h-10 gap-2 mt-2 text-black font-semibold" style={{ backgroundColor: accentColor }} onClick={handleSubmitOrder} disabled={orderState === 'saving'}>
                      {orderState === 'saving' ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />{isAr ? 'جاري الحفظ...' : 'Saving...'}</>
                      ) : (
                        <><MessageCircle className="w-4 h-4" />{isAr ? 'تأكيد الطلب عبر واتساب' : 'Confirm via WhatsApp'}</>
                      )}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      {isAr ? 'سيتم حفظ طلبك وفتح واتساب تلقائياً' : 'Your order will be saved and WhatsApp will open automatically'}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
