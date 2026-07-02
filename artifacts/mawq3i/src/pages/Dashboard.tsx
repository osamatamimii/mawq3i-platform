import { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { Order, Product } from '@/data/mockData';
import { getOrders, getProducts } from '@/lib/db';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ShoppingCart, Package, AlertTriangle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { requestNotificationPermission } from '@/lib/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }
  })
};

const statusDot: Record<string, string> = {
  new: 'bg-blue-400',
  processing: 'bg-amber-400',
  delivered: 'bg-primary',
  cancelled: 'bg-red-400',
};
const statusColors: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  processing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  delivered: 'bg-primary/10 text-primary border-primary/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};
const statusLabels: Record<string, { ar: string; en: string }> = {
  new: { ar: 'جديد', en: 'New' },
  processing: { ar: 'قيد التجهيز', en: 'Processing' },
  delivered: { ar: 'تم التسليم', en: 'Delivered' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
};

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStore?.id) return;
    Promise.all([
      getOrders(currentStore.id, isAdminMode),
      getProducts(currentStore.id, isAdminMode),
    ]).then(([o, p]) => {
      setOrders(o);
      setProducts(p);
      setLoading(false);
    });
  }, [currentStore?.id]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const currency = currentStore?.currency === 'SAR' ? '﷼' : '₪';
  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'cancelled'), [orders]);
  const totalSales = useMemo(() => activeOrders.reduce((sum, o) => sum + o.amount, 0), [activeOrders]);
  const lowStockCount = products.filter(p => p.stock <= 5).length;
  const recentOrders = orders.slice(0, 5);
  const topProducts = products.filter(p => p.status === 'visible').slice(0, 4);

  // Last 14 days of sales, derived from real order dates/amounts
  const sparkData = useMemo(() => {
    const days: { date: string; value: number }[] = [];
    const map: Record<string, number> = {};
    activeOrders.forEach((o) => {
      const t = new Date(o.date as any);
      if (isNaN(t.getTime())) return;
      const k = dayKey(t);
      map[k] = (map[k] || 0) + o.amount;
    });
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      days.push({ date: k, value: map[k] || 0 });
    }
    return days;
  }, [activeOrders]);

  // Trend: last 7 days vs previous 7 days, only shown if there's enough real history
  const trend = useMemo(() => {
    const last7 = sparkData.slice(7).reduce((s, d) => s + d.value, 0);
    const prev7 = sparkData.slice(0, 7).reduce((s, d) => s + d.value, 0);
    if (prev7 === 0) return null;
    const pct = ((last7 - prev7) / prev7) * 100;
    return Math.round(pct * 10) / 10;
  }, [sparkData]);

  // Revenue per product, derived from real order items
  const revenueByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    activeOrders.forEach((o) => {
      if (o.items && o.items.length > 0) {
        o.items.forEach((it) => { map[it.productName] = (map[it.productName] || 0) + it.price * it.quantity; });
      } else if (o.productName) {
        map[o.productName] = (map[o.productName] || 0) + o.amount;
      }
    });
    return map;
  }, [activeOrders]);

  const spotlight = topProducts[0];
  const spotlightName = spotlight ? (isAr ? spotlight.nameAr : spotlight.nameEn) : '';
  const spotlightRevenue = spotlight ? (revenueByProduct[spotlightName] || 0) : 0;
  const spotlightShare = totalSales > 0 ? Math.min(100, Math.round((spotlightRevenue / totalSales) * 100)) : 0;
  const restProducts = topProducts.slice(1);

  const statCards = [
    {
      titleAr: 'عدد الطلبات', titleEn: 'Total Orders',
      value: String(orders.length),
      icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-400/10', ring: 'ring-blue-400/20',
    },
    {
      titleAr: 'عدد المنتجات', titleEn: 'Products',
      value: String(products.length),
      icon: Package, color: 'text-violet-400', bg: 'bg-violet-400/10', ring: 'ring-violet-400/20',
    },
    {
      titleAr: 'منتجات منخفضة المخزون', titleEn: 'Low Stock',
      value: String(lowStockCount),
      icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10', ring: 'ring-amber-400/20',
    },
  ];

  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const TrendIcon = (trend ?? 0) >= 0 ? TrendingUp : TrendingDown;
  const R = 54;
  const CIRC = 2 * Math.PI * R;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={card.titleAr} custom={i} initial="hidden" animate="visible" variants={cardVariants} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
            <Card className="bg-card/80 border-border/50 hover:border-border transition-colors cursor-default shadow-lg h-full">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium tracking-wide">
                      {isAr ? card.titleAr : card.titleEn}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground font-mono tabular-nums">{card.value}</p>
                  </div>
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${card.bg} ring-4 ${card.ring} flex-shrink-0`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Flagship glow card: total sales + real 14-day sparkline */}
        <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants} whileHover={{ y: -3, transition: { duration: 0.2 } }} className="sm:col-span-2 lg:col-span-1">
          <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card shadow-lg shadow-primary/5 h-full">
            <div className="pointer-events-none absolute -top-10 -end-10 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />
            <CardContent className="p-5 sm:p-6 relative">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium tracking-wide">
                    {isAr ? 'إجمالي المبيعات' : 'Total Sales'}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground font-mono tabular-nums">
                    {currency}{totalSales.toLocaleString()}
                  </p>
                </div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center bg-primary/15 ring-4 ring-primary/20 flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
              </div>

              <div className="h-12 -mx-1 mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="salesGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#salesGlow)" isAnimationActive />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {trend !== null && (
                <div className="flex items-center gap-1 mt-1">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-primary/15 text-primary' : 'bg-red-500/15 text-red-400'}`}>
                    <TrendIcon className="w-3 h-3" />
                    {trend >= 0 ? '+' : ''}{trend}%
                  </span>
                  <span className="text-[11px] text-muted-foreground">{isAr ? 'مقابل الأسبوع السابق' : 'vs last week'}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <Card className="bg-card/80 border-border/50 shadow-lg h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base font-semibold">{isAr ? 'آخر الطلبات' : 'Recent Orders'}</CardTitle>
              <Link href="/dashboard/orders">
                <span className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors cursor-pointer">
                  {isAr ? 'عرض الكل' : 'View all'}<ArrowIcon className="w-3 h-3" />
                </span>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-2">
                  <span className="text-3xl">📭</span>
                  <p className="text-sm">{isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
                  <p className="text-xs opacity-60">{isAr ? 'ستظهر هنا طلبات عملاء متجرك' : 'Customer orders will appear here'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-start px-6 py-3 text-muted-foreground font-medium">{isAr ? 'رقم الطلب' : 'Order ID'}</th>
                        <th className="text-start px-6 py-3 text-muted-foreground font-medium">{isAr ? 'العميل' : 'Customer'}</th>
                        <th className="text-start px-6 py-3 text-muted-foreground font-medium">{isAr ? 'المبلغ' : 'Amount'}</th>
                        <th className="text-start px-6 py-3 text-muted-foreground font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order, i) => (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 + i * 0.05, duration: 0.3 }}
                          className="border-b border-border/30 hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="px-6 py-4 font-mono text-xs text-primary font-bold">{order.id}</td>
                          <td className="px-6 py-4 font-medium">{order.customerName}</td>
                          <td className="px-6 py-4">
                            <span className="font-mono font-semibold">
                              {order.currency === 'ILS' ? '₪' : '﷼'}{order.amount}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[order.status]}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusDot[order.status]}`} />
                              {isAr ? statusLabels[order.status]?.ar : statusLabels[order.status]?.en}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <Card className="bg-card/80 border-border/50 shadow-lg h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base font-semibold">{isAr ? 'أفضل المنتجات' : 'Top Products'}</CardTitle>
              <Link href="/dashboard/products">
                <span className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors cursor-pointer">
                  {isAr ? 'عرض الكل' : 'View all'}<ArrowIcon className="w-3 h-3" />
                </span>
              </Link>
            </CardHeader>
            <CardContent className="space-y-5">
              {!spotlight ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <span className="text-3xl">📦</span>
                  <p className="text-sm">{isAr ? 'لا توجد منتجات بعد' : 'No products yet'}</p>
                </div>
              ) : (
                <>
                  {/* Spotlight: #1 product with real revenue-share ring */}
                  <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.06] to-transparent p-5 overflow-hidden">
                    <span className="absolute top-3 end-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">#1</span>
                    <div className="flex items-center gap-4">
                      <div className="relative w-[104px] h-[104px] flex-shrink-0">
                        <svg width="104" height="104" viewBox="0 0 120 120" className="-rotate-90">
                          <circle cx="60" cy="60" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
                          <motion.circle
                            cx="60" cy="60" r={R} fill="none" stroke="hsl(var(--primary))" strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={CIRC}
                            initial={{ strokeDashoffset: CIRC }}
                            animate={{ strokeDashoffset: CIRC - (spotlightShare / 100) * CIRC }}
                            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-base font-bold font-mono text-foreground">{currency}{spotlightRevenue.toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground">{isAr ? 'مبيعات' : 'sales'}</span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground overflow-hidden mb-2">
                          {spotlight.imageUrl ? <img src={spotlight.imageUrl} alt="" className="w-full h-full object-cover" /> : '1'}
                        </div>
                        <p className="font-semibold text-sm truncate">{spotlightName}</p>
                        <p className="text-xs text-muted-foreground">{isAr ? `مخزون: ${spotlight.stock}` : `Stock: ${spotlight.stock}`}</p>
                        {totalSales > 0 && (
                          <p className="text-[11px] text-primary mt-0.5">{spotlightShare}% {isAr ? 'من مبيعاتك' : 'of your sales'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {restProducts.map((product, i) => (
                    <div key={product.id} className="flex items-center gap-3 group">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0 overflow-hidden">
                        {product.imageUrl
                          ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                          : (i + 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{isAr ? product.nameAr : product.nameEn}</p>
                        <p className="text-xs text-muted-foreground">{product.category}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-sm font-mono">
                          {product.currency === 'ILS' ? '₪' : '﷼'}{product.price}
                        </p>
                        <p className="text-xs text-muted-foreground">{isAr ? `مخزون: ${product.stock}` : `Stock: ${product.stock}`}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
