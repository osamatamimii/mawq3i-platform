import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getOrders, getProducts } from '@/lib/db';
import { Order, Product } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, ShoppingBag, Package, Star, FileDown } from 'lucide-react';

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
  const { language, currentStore, isAdminMode, theme } = useAppContext();
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
    { titleAr: 'إجمالي المبيعات', titleEn: 'Total Sales', value: `${currency}${animTotal.toLocaleString()}`, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20', glow: true },
    { titleAr: 'إجمالي الطلبات', titleEn: 'Total Orders', value: animOrders, icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-400/10', ring: 'ring-blue-400/20' },
    { titleAr: 'تم التسليم', titleEn: 'Delivered', value: animDelivered, icon: Package, color: 'text-emerald-400', bg: 'bg-emerald-400/10', ring: 'ring-emerald-400/20' },
    { titleAr: 'متوسط قيمة الطلب', titleEn: 'Avg Order', value: `${currency}${animAvg}`, icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10', ring: 'ring-amber-400/20' },
  ];


  // ── PDF Export ──────────────────────────────────────────
  const exportPDF = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString(isAr ? 'ar-PS' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const storeName = currentStore?.name || 'Store';
    const curr = currentStore?.currency === 'SAR' ? '﷼' : '₪';

    const topProducts = [...products]
      .map(p => ({
        name: p.nameAr,
        count: orders.filter(o => o.items?.some((i: any) => i.productId === p.id || i.product_id === p.id)).length,
        revenue: orders.filter(o => o.status !== 'cancelled' && o.items?.some((i: any) => i.productId === p.id || i.product_id === p.id)).reduce((s, o) => s + o.amount, 0),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const statusRows = ['new', 'processing', 'delivered', 'cancelled'].map(s => ({
      label: s === 'new' ? (isAr ? 'جديد' : 'New') : s === 'processing' ? (isAr ? 'قيد التجهيز' : 'Processing') : s === 'delivered' ? (isAr ? 'تم التسليم' : 'Delivered') : (isAr ? 'ملغي' : 'Cancelled'),
      count: orders.filter(o => o.status === s).length,
      pct: orders.length > 0 ? Math.round(orders.filter(o => o.status === s).length / orders.length * 100) : 0,
    }));

    const html = `<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="UTF-8">
<title>${isAr ? 'تقرير المبيعات' : 'Sales Report'} - ${storeName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo', sans-serif; background: #f8fafc; color: #1e293b; padding: 32px; }
  .header { background: linear-gradient(135deg, #0d1117 0%, #1a2332 100%); color: white; padding: 32px; border-radius: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-dot { width: 40px; height: 40px; background: #52FF3F; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; color: #0d1117; }
  .brand-name { font-size: 22px; font-weight: 700; }
  .brand-sub { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 2px; }
  .report-meta { text-align: ${isAr ? 'left' : 'right'}; }
  .report-title { font-size: 14px; color: rgba(255,255,255,0.6); }
  .report-date { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 4px; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .stat-card { background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; }
  .stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .stat-value { font-size: 26px; font-weight: 700; color: #0f172a; }
  .stat-accent { color: #52FF3F; }
  .section { background: white; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; overflow: hidden; }
  .section-header { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; background: #f8fafc; }
  .section-title { font-size: 14px; font-weight: 600; color: #374151; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 10px 20px; text-align: ${isAr ? 'right' : 'left'}; font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; background: #f8fafc; }
  td { padding: 12px 20px; border-top: 1px solid #f1f5f9; font-size: 13px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #16a34a; }
  .badge-yellow { background: #fef9c3; color: #ca8a04; }
  .badge-blue { background: #dbeafe; color: #2563eb; }
  .badge-red { background: #fee2e2; color: #dc2626; }
  .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #94a3b8; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand">
    <div class="brand-dot">M</div>
    <div>
      <div class="brand-name">${storeName}</div>
      <div class="brand-sub">Powered by Mawq3i | موقعي</div>
    </div>
  </div>
  <div class="report-meta">
    <div class="report-title">${isAr ? 'تقرير المبيعات الشامل' : 'Comprehensive Sales Report'}</div>
    <div class="report-date">${dateStr}</div>
  </div>
</div>

<div class="stats-grid">
  <div class="stat-card"><div class="stat-label">${isAr ? 'إجمالي المبيعات' : 'Total Revenue'}</div><div class="stat-value stat-accent">${curr}${totalSales.toLocaleString()}</div></div>
  <div class="stat-card"><div class="stat-label">${isAr ? 'إجمالي الطلبات' : 'Total Orders'}</div><div class="stat-value">${totalOrders}</div></div>
  <div class="stat-card"><div class="stat-label">${isAr ? 'تم التسليم' : 'Delivered'}</div><div class="stat-value">${deliveredOrders}</div></div>
  <div class="stat-card"><div class="stat-label">${isAr ? 'متوسط الطلب' : 'Avg Order'}</div><div class="stat-value">${curr}${avgOrder.toLocaleString()}</div></div>
</div>

<div class="section">
  <div class="section-header"><div class="section-title">${isAr ? 'حالة الطلبات' : 'Orders by Status'}</div></div>
  <table>
    <thead><tr><th>${isAr ? 'الحالة' : 'Status'}</th><th>${isAr ? 'العدد' : 'Count'}</th><th>${isAr ? 'النسبة' : 'Percentage'}</th></tr></thead>
    <tbody>
      ${statusRows.map(r => `<tr><td>${r.label}</td><td><strong>${r.count}</strong></td><td>${r.pct}%</td></tr>`).join('')}
    </tbody>
  </table>
</div>

${topProducts.length > 0 ? `
<div class="section">
  <div class="section-header"><div class="section-title">${isAr ? 'أفضل المنتجات مبيعاً' : 'Top Products'}</div></div>
  <table>
    <thead><tr><th>#</th><th>${isAr ? 'المنتج' : 'Product'}</th><th>${isAr ? 'الطلبات' : 'Orders'}</th><th>${isAr ? 'الإيرادات' : 'Revenue'}</th></tr></thead>
    <tbody>
      ${topProducts.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.count}</td><td>${curr}${p.revenue.toLocaleString()}</td></tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

<div class="footer">Mawq3i | موقعي — ${dateStr}</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 800);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{isAr ? 'الإحصائيات' : 'Analytics'}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{isAr ? 'تقارير مبيعاتك الحقيقية' : 'Your real sales reports'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2 h-9">
          <FileDown className="w-4 h-4" />
          {isAr ? 'تصدير PDF' : 'Export PDF'}
        </Button>
      </div>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
            <Card className={card.glow
              ? 'relative overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card shadow-lg shadow-primary/5 h-full'
              : 'bg-card/80 border-border/50 hover:border-border transition-colors shadow-lg h-full'
            }>
              {card.glow && <div className="pointer-events-none absolute -top-8 -end-8 w-32 h-32 rounded-full bg-primary/20 blur-3xl" />}
              <CardContent className="p-5 sm:p-6 relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium tracking-wide">{isAr ? card.titleAr : card.titleEn}</p>
                    <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums">{card.value}</p>
                  </div>
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center ${card.bg} ring-4 ${card.ring} flex-shrink-0`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Weekly Sales Chart */}
      <Card className="bg-card/80 border-border/50 shadow-lg">
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
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'} />
                <XAxis dataKey="day" tick={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: theme === 'dark' ? '#1a1a1a' : '#ffffff', border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', borderRadius: 4, color: theme === 'dark' ? '#f0ede8' : '#111', fontSize: 12 }} formatter={(v: any) => [`${currency}${v}`, isAr ? 'المبيعات' : 'Sales']} />
                <Bar dataKey="sales" fill={theme === 'dark' ? '#52FF3F' : '#16a34a'} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status */}
        <Card className="bg-card/80 border-border/50 shadow-lg">
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
        <Card className="bg-card/80 border-border/50 shadow-lg">
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
