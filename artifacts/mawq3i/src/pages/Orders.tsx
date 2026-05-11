import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { initialOrders, Order, OrderStatus } from '@/data/mockData';
import { getOrders, updateOrderStatus } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Loader2 } from 'lucide-react';

const statusConfig: Record<OrderStatus, { ar: string; en: string; className: string }> = {
  new: { ar: 'جديد', en: 'New', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30' },
  processing: { ar: 'قيد التجهيز', en: 'Processing', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30' },
  delivered: { ar: 'تم التسليم', en: 'Delivered', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', className: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' },
};

export default function Orders() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrders().then(data => {
      setOrders(data);
      setLoading(false);
    });
  }, []);

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    await updateOrderStatus(id, status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="bg-card border-border/50 shadow-lg">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-lg font-semibold">
            {isAr ? 'قائمة الطلبات' : 'Orders List'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{orders.length} {isAr ? 'طلب' : 'orders'}</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'رقم الطلب' : 'Order ID'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'اسم العميل' : 'Customer'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'رقم الهاتف' : 'Phone'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'المنتج' : 'Product'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'حالة الطلب' : 'Status'}</th>
                  <th className="text-start px-6 py-4 font-medium">{isAr ? 'التاريخ' : 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl">📭</span>
                        <p className="text-sm">{isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
                        <p className="text-xs opacity-60">{isAr ? 'ستظهر هنا عند وصول أول طلب من المتجر' : 'Orders from your store will appear here'}</p>
                      </div>
                    </td>
                  </tr>
                ) : orders.map((order, i) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border/30 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-primary font-bold">{order.id}</td>
                    <td className="px-6 py-4 font-medium">{order.customerName}</td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground" dir="ltr">{order.phone}</td>
                    <td className="px-6 py-4 text-sm max-w-[140px] truncate">{order.productName || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold font-mono">
                        {order.currency === 'ILS' ? '₪' : '﷼'}{order.amount}
                      </span>
                      <span className="text-xs text-muted-foreground ms-1">{order.currency}</span>
                    </td>
                    <td className="px-6 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${statusConfig[order.status].className}`}>
                            {isAr ? statusConfig[order.status].ar : statusConfig[order.status].en}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="bg-popover border-border">
                          {(Object.keys(statusConfig) as OrderStatus[]).map(s => (
                            <DropdownMenuItem key={s} onClick={() => handleStatusChange(order.id, s)} className="cursor-pointer">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border me-2 ${statusConfig[s].className}`}>
                                {isAr ? statusConfig[s].ar : statusConfig[s].en}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono">{order.date}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
