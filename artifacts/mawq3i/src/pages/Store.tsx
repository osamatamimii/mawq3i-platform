import { useAppContext } from '@/context/AppContext';
import { initialProducts } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function Store() {
  const { language } = useAppContext();
  const isAr = language === 'ar';

  const visibleProducts = initialProducts.filter(p => p.status === 'visible');

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-6 bg-primary rounded-full shadow-[0_0_12px_rgba(82,255,63,0.6)]" />
            <span className="text-lg font-bold">Mawq3i | موقعي</span>
          </div>
          <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
            {isAr ? 'تواصل معنا' : 'Contact Us'}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              {isAr ? 'مرحباً بكم في متجرنا' : 'Welcome to our store'}
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 leading-tight">
              {isAr ? 'تسوق معنا' : 'Shop With Us'}
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10">
              {isAr
                ? 'منتجات أصيلة وفاخرة تصل إليك بكل سهولة وسرعة'
                : 'Premium authentic products delivered to your door with ease'}
            </p>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                className="h-12 px-8 text-base font-semibold gap-2 shadow-[0_0_30px_rgba(82,255,63,0.25)] hover:shadow-[0_0_40px_rgba(82,255,63,0.35)] transition-all"
                onClick={() => window.open('https://wa.me', '_blank')}
              >
                <MessageCircle className="w-5 h-5" />
                {isAr ? 'اطلب عبر واتساب' : 'Order via WhatsApp'}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Products */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <motion.div
          className="mb-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-2xl font-bold">{isAr ? 'منتجاتنا' : 'Our Products'}</h2>
          <p className="text-muted-foreground mt-1">{isAr ? 'اكتشف مجموعتنا المميزة' : 'Discover our curated collection'}</p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {visibleProducts.map((product) => (
            <motion.div
              key={product.id}
              variants={cardVariants}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="group bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-primary/20 transition-colors cursor-pointer shadow-lg hover:shadow-primary/5"
            >
              {/* Product Image Placeholder */}
              <div className="aspect-square bg-gradient-to-br from-muted to-background relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/20 transition-colors">
                      <span className="text-2xl">{['🕌', '🌿', '💎', '☕', '🫐', '🪔', '✨', '💍'][parseInt(product.id) - 1] ?? '📦'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-sm line-clamp-1">{isAr ? product.nameAr : product.nameEn}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold font-mono text-primary">
                    {product.currency === 'ILS' ? '₪' : '﷼'}{product.price}
                  </span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">
                    {product.currency}
                  </span>
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    className="w-full h-9 text-xs gap-1.5"
                    onClick={() => window.open('https://wa.me', '_blank')}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {isAr ? 'طلب عبر واتساب' : 'Order via WhatsApp'}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-1.5 h-4 bg-primary rounded-full shadow-[0_0_8px_rgba(82,255,63,0.5)]" />
            <span className="font-semibold text-sm">Mawq3i | موقعي</span>
          </div>
          <p>{isAr ? 'مدعوم بواسطة موقعي - منصة المتاجر الإلكترونية' : 'Powered by Mawq3i - eCommerce Platform'}</p>
        </div>
      </footer>
    </div>
  );
}
