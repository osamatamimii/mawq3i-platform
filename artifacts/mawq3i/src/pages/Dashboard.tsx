import { useState } from 'react';
import { Link } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { initialProducts, initialOrders } from '@/data/mockData';
import { motion } from 'framer-motion';
import { TrendingUp, ShoppingCart, Package, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 }
  })
};

export default function Dashboard() {
  const { language } = useAppContext();
  const isAr = language === 'ar';

  const statCards = [
    {
      titleAr: 'إجمالي المبيعات',
      titleEn: 'Total Sales',
      value: '₪24,500',
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
      trend: '+12%',
    },
    {
      titleAr: 'عدد الطلبات',
      titleEn: 'Total Orders',
      value: '148',
      icon: ShoppingCart,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      trend: '+8%',
    },
    {
      titleAr: 'عدد المنتجات',
      titleEn: 'Products',
      value: '36',
      icon: Package,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      trend: '+3',
    },
    {
      titleAr: 'منتجات منخفضة المخزون',
      titleEn: 'Low Stock',
      value: '4',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      trend: '!',
    },
  ];

  const statusColors: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    processing: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    delivered: 'bg-primary/20 text-primary border-primary/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const statusLabels: Record<string, { ar: string; en: string }> = {
    new: { ar: 'جديد', en: 'New' },
    processing: { ar: 'قيد التجهيز', en: 'Processing' },
    delivered: { ar: 'تم التسليم', en: 'Delivered' },
    cancelled: { ar: 'ملغي', en: 'Cancelled' },
  };

  const recentOrders = initialOrders.slice(0, 5);
  const topProducts = initialProducts.filter(p => p.status === 'visible').slice(0, 3);

  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.titleAr}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
          >
            <Card className="bg-card border-border/50 hover:border-primary/20 transition-colors cursor-default shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-medium tracking-wide uppercase">
                      {isAr ? card.titleAr : card.titleEn}
                    </p>
                    <p className="text-3xl font-bold text-foreground">{card.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.bg}`}>
                    <card.icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                </div>
                <p className={`text-xs mt-3 font-medium ${card.color}`}>{card.trend} {isAr ? 'من الشهر الماضي' : 'from last month'}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <Card className="bg-card border-border/50 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base font-semibold">
                {isAr ? 'آخر الطلبات' : 'Recent Orders'}
              </CardTitle>
              <Link href="/orders">
                <span className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors cursor-pointer">
                  {isAr ? 'عرض الكل' : 'View all'}
                  <ArrowIcon className="w-3 h-3" />
                </span>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
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
                    {recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-border/30 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{order.id}</td>
                        <td className="px-6 py-4 font-medium">{order.customerName}</td>
                        <td className="px-6 py-4">
                          <span className="font-mono font-semibold">
                            {order.currency === 'ILS' ? '₪' : '﷼'}{order.amount}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[order.status]}`}>
                            {isAr ? statusLabels[order.status].ar : statusLabels[order.status].en}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <Card className="bg-card border-border/50 shadow-lg h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-base font-semibold">
                {isAr ? 'أفضل المنتجات' : 'Top Products'}
              </CardTitle>
              <Link href="/products">
                <span className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors cursor-pointer">
                  {isAr ? 'عرض الكل' : 'View all'}
                  <ArrowIcon className="w-3 h-3" />
                </span>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {topProducts.map((product, i) => (
                <div key={product.id} className="flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground flex-shrink-0">
                    {i + 1}
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
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
