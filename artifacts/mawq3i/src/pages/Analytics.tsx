import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getOrders, getProducts } from '@/lib/db';
import { Order, Product } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, ShoppingCart, Package, DollarSign } from 'lucide-react';

export default function Analytics() {
  const { language, currentStore } = useAppContext();
  const isAr = language === 'ar';
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStore?.id) return;
    Promise.all([getOrders(currentStore.id), getProducts(currentStore.id)]).then(([o, p]) => {
      setOrders(o);
      setProducts(p);
      setLoading(false);
    });
  }, [currentStore?.id]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  // Real calculations
  const totalSales = orders.reduce((s, o) => s + o.amount, 0);
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
  const newOrders = orders.filter(o => o.status === 'new').length;
  const currency = orders[0]?.currency === 'SAR' ? '﷼' : '₪';

  // Orders by day (last 7 days)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayOrders = orders.filter(o => o.date === dateStr);
    return {
      day: d.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'short' }),
      orders: dayOrders.length,
      sales: dayOrders.reduce((s, o) => s + o.amount, 0),
    };
  });

  // Orders by status
  const statusData = [
    { name: isAr ? 'جديد' : 'New', value: orders.filter(o => o.status === 'new').length, color: '#3b82f6' },
    { name: isAr ? 'قيد التجهيز' : 'Processing', value: orders.filter(o => o.status === 'processing').length, color: '#f59e0b' },
    { name: isAr ? 'تم التسليم' : 'Delivered', value: orders.filter(o => o.status === 'delivered').length, color: '#52FF3F' },
    { name: isAr ? 'ملغي' : 'Cancelled', value: orders.filter(o => o.status === 'cancelled').length, color: '#ef4444' },
  ];

  // Top products by orders
  const productSales: Record<string, { name: string; count: number; revenue: number }> = {};
  orders.forEach(o => {
    if (!o.productName) return;
    const key = o.productName;
    if (!productSales[key]) productSales[key] = { name: key, count: 0, revenue: 0 };
    productSales[key].count++;
    productSales[key].revenue += o.amount;
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.count - a.count).slice(0, 5);

  const stats = [
    { titleAr: 'إجمالي المبيعات', titleEn: 'Total Sales', value: `${currency}${totalSales.toLocaleString()}`, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
    { titleAr: 'عدد الطلبات', titleEn: 'Total Orders', value: orders.length, icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { titleAr: 'طلبات منجزة', titleEn: 'Delivered', value: deliveredOrders, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { titleAr: 'طلبات جديدة', titleEn: 'New Orders', value: newOrders, icon: Package, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ];

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <span className="text-5xl">📊</span>
        <p className="text-sm font-medium">{isAr ? 'لا توجد بيانات بعد' : 'No data yet'}</p>
        <p className="text-xs opacity-60">{isAr ? 'ستظهر الإحصائيات هنا عند وصول الطلبات' : 'Stats will appear here once orders arrive'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.titleAr} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="bg-card border-border/50 shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">{isAr ? s.titleAr : s.titleEn}</p>
                    <p className="text-2xl font-bold font-mono">{s.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-card border-border/50 shadow-lg">
            <CardHeader className="pb-4"><CardTitle className="text-sm">{isAr ? 'المبيعات — آخر 7 أيام' : 'Sales — Last 7 Days'}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="day" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }} />
                  <Bar dataKey="sales" fill="#52FF3F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-card border-border/50 shadow-lg">
            <CardHeader className="pb-4"><CardTitle className="text-sm">{isAr ? 'الطلبات — آخر 7 أيام' : 'Orders — Last 7 Days'}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="day" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="orders" stroke="#52FF3F" strokeWidth={2} dot={{ fill: '#52FF3F', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top products & Status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {topProducts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="bg-card border-border/50 shadow-lg">
              <CardHeader className="pb-4"><CardTitle className="text-sm">{isAr ? 'أكثر المنتجات مبيعاً' : 'Top Selling Products'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(p.count / topProducts[0].count) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono font-semibold">{currency}{p.revenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{p.count} {isAr ? 'طلب' : 'orders'}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="bg-card border-border/50 shadow-lg">
            <CardHeader className="pb-4"><CardTitle className="text-sm">{isAr ? 'توزيع الطلبات' : 'Orders Breakdown'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {statusData.map(s => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <p className="text-sm flex-1">{s.name}</p>
                  <p className="font-mono text-sm font-semibold">{s.value}</p>
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: orders.length ? `${(s.value / orders.length) * 100}%` : '0%', background: s.color }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
