import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getOrders, getProducts } from '@/lib/db';
import { Order, Product } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, ShoppingBag, Package, Star } from 'lucide-react';

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

export default function Analytics() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getOrders(currentStore?.id, isAdminMode),
      getProducts(currentStore?.id, isAdminMode),
    ]).then(([o, p]) => { setOrders(o); setProducts(p); setLoading(false); });
  }, [currentStore?.id]);

  // Compute real stats
  const totalSales = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.amount, 0);
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
  const avgOrder = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
  const currency = currentStore?.currency === 'SAR' ? '﷼' : '₪';

  // Sales by day (last 7 days)
  const dailyMap: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dailyMap[key] = 0;
  }
  orders.filter(o => o.status !== 'cancelled').forEach(o => {
    const d = o.date?.split('T')[0] || o.date;
    if (d in dailyMap) dailyMap[d] += o.amount;
  });
  const weeklyData = Object.entries(dailyMap).map(([date, sales]) => ({
    day: new Date(date).toLocaleDateString(isAr ? 'ar-PS' : 'en-US', { weekday: 'short' }),
    sales,
  }));

  // Orders by status
  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  // Top products by order count — read from items array, fallback to product_name
  const productSales: Record<string, number> = {};
  orders.forEach(o => {
    const items = Array.isArray(o.items) ? o.items : [];
    if (items.length > 0) {
      items.forEach((item: any) => {
        const name = item.name || item.productName || item.product_name || 'Unknown';
        productSales[name] = (productSales[name] || 0) + (item.qty || item.quantity || 1);
      });
    } else {
      const name = (o as any).product_name || o.productName || '';
      if (name) productSales[name] = (productSales[name] || 0) + 1;
    }
  });
  const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const animTotal = useCountUp(totalSales);
  const animOrders = useCountUp(totalOrders);
  const animDelivered = useCountUp(deliveredOrders);
  const animAvg = useCountUp(avgOrder);

  const statCards = [
    { titleAr: 'إجمالي المبيعات', titleEn: 'Total Sales', value: `${currency}${animTotal.toLocaleString()}`, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
    { titleAr: 'إجمالي الطلبات', titleEn: 'Total Orders', value: animOrders, icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { titleAr: 'تم التسليم', titleEn: 'Delivered', value: animDelivered, icon: Package, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { titleAr: 'متوسط قيمة الطلب', titleEn: 'Avg Order', value: `${currency}${animAvg}`, icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="bg-card border-border/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-medium tracking-wide uppercase">{isAr ? card.titleAr : card.titleEn}</p>
                    <p className="text-2xl font-bold font-mono">{card.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bg}`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Weekly Sales Chart */}
      <Card className="bg-card border-border/50 shadow-lg">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">{isAr ? 'المبيعات — آخر 7 أيام' : 'Sales — Last 7 Days'}</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {totalSales === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
              <span className="text-3xl">📊</span>
              <p className="text-sm">{isAr ? 'لا توجد بيانات مبيعات بعد' : 'No sales data yet'}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,237,232,0.06)" />
                <XAxis dataKey="day" tick={{ fill: 'rgba(240,237,232,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(240,237,232,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(240,237,232,0.1)', borderRadius: 4, color: '#f0ede8', fontSize: 12 }} formatter={(v: any) => [`${currency}${v}`, isAr ? 'المبيعات' : 'Sales']} />
                <Bar dataKey="sales" fill="#52FF3F" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status */}
        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">{isAr ? 'حالة الطلبات' : 'Orders by Status'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-3">
            {totalOrders === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">{isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
            ) : [
              { key: 'new', labelAr: 'جديد', labelEn: 'New', color: 'bg-blue-500' },
              { key: 'processing', labelAr: 'قيد التجهيز', labelEn: 'Processing', color: 'bg-amber-500' },
              { key: 'delivered', labelAr: 'تم التسليم', labelEn: 'Delivered', color: 'bg-emerald-500' },
              { key: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled', color: 'bg-red-500' },
            ].map(s => {
              const count = statusCounts[s.key] || 0;
              const pct = totalOrders > 0 ? Math.round(count / totalOrders * 100) : 0;
              return (
                <div key={s.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{isAr ? s.labelAr : s.labelEn}</span>
                    <span className="font-mono font-medium">{count} <span className="text-muted-foreground">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2 }} className={`h-full rounded-full ${s.color}`} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="bg-card border-border/50 shadow-lg">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">{isAr ? 'أكثر المنتجات طلباً' : 'Top Ordered Products'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-3">
            {topProducts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">{isAr ? 'لا توجد بيانات بعد' : 'No data yet'}</p>
            ) : topProducts.map(([name, count], i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                </div>
                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{count} {isAr ? 'طلب' : 'orders'}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
