import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Order, OrderStatus } from '@/data/mockData';
import { getOrders, updateOrderStatus } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Loader2, Bell, X, Phone, MapPin, CreditCard, Package, MessageSquare, Calendar } from 'lucide-react';

const statusConfig: Record<OrderStatus, { ar: string; en: string; className: string }> = {
  new:        { ar: 'جديد',         en: 'New',        className: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30' },
  processing: { ar: 'قيد التجهيز', en: 'Processing',  className: 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30' },
  delivered:  { ar: 'تم التسليم',   en: 'Delivered',   className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' },
  cancelled:  { ar: 'ملغي',         en: 'Cancelled',   className: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' },
};

export default function Orders() {
  const { language, currentStore } = useAppContext();
  const isAr = language === 'ar';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    getOrders(currentStore?.id).then(data => { setOrders(data); setLoading(false); });
  }, [currentStore?.id]);

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, status } : null);
    await updateOrderStatus(id, status);
    if (status === 'delivered' || status === 'processing') {
      const order = orders.find(o => o.id === id);
      if (order?.phone) {
        const msg = status === 'delivered'
          ? `مرحباً ${order.customerName}، تم توصيل طلبك رقم ${order.id} بنجاح. شكراً لتسوقك معنا! 🎉`
          : `مرحباً ${order.customerName}، طلبك رقم ${order.id} قيد التجهيز وسيصلك قريباً. 📦`;
        window.open(`https://wa.me/${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
      }
    }
  };

  const cur = (o: Order) => o.currency === 'ILS' ? '₪' : '﷼';

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="bg-card border-border/50 shadow-lg">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold">{isAr ? 'قائمة الطلبات' : 'Orders List'}</CardTitle>
            {orders.filter(o => o.status === 'new').length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Bell className="w-3 h-3" />
                {orders.filter(o => o.status === 'new').length} {isAr ? 'جديد' : 'new'}
              </span>
            )}
          </div>
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
                  <tr><td colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">📭</span>
                      <p className="text-sm">{isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
                      <p className="text-xs opacity-60">{isAr ? 'ستظهر هنا طلبات عملاء متجرك' : 'Orders will appear here'}</p>
                    </div>
                  </td></tr>
                ) : orders.map((order, i) => (
                  <motion.tr key={order.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="border-b border-border/30 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => setSelectedOrder(order)}>
                    <td className="px-6 py-4 font-mono text-xs text-primary font-bold">{order.id}</td>
                    <td className="px-6 py-4 font-medium">{order.customerName}</td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground" dir="ltr">{order.phone}</td>
                    <td className="px-6 py-4 text-sm max-w-[140px] truncate">{order.productName || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold font-mono">{cur(order)}{order.amount}</span>
                      <span className="text-xs text-muted-foreground ms-1">{order.currency}</span>
                    </td>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
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

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedOrder(null)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-card border border-border/50 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <div>
                  <h2 className="font-semibold text-base">{isAr ? 'تفاصيل الطلب' : 'Order Details'}</h2>
                  <p className="text-xs font-mono text-primary mt-0.5">{selectedOrder.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig[selectedOrder.status].className}`}>
                    {isAr ? statusConfig[selectedOrder.status].ar : statusConfig[selectedOrder.status].en}
                  </span>
                  <button onClick={() => setSelectedOrder(null)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/5">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Customer Info */}
                <div className="bg-white/[0.03] rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'معلومات العميل' : 'Customer Info'}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-primary font-bold">{selectedOrder.customerName?.[0] || '?'}</span>
                      </div>
                      <div><p className="text-xs text-muted-foreground">{isAr ? 'الاسم' : 'Name'}</p><p className="text-sm font-medium">{selectedOrder.customerName}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div><p className="text-xs text-muted-foreground">{isAr ? 'الهاتف' : 'Phone'}</p>
                        <a href={`tel:${selectedOrder.phone}`} className="text-sm font-mono text-primary hover:underline" dir="ltr">{selectedOrder.phone}</a>
                      </div>
                    </div>
                  </div>
                  {(selectedOrder as any).city && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div><p className="text-xs text-muted-foreground">{isAr ? 'العنوان' : 'Address'}</p>
                        <p className="text-sm">{(selectedOrder as any).city}{(selectedOrder as any).address ? ` — ${(selectedOrder as any).address}` : ''}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Items */}
                <div className="bg-white/[0.03] rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'المنتجات' : 'Products'}</h3>
                  {(() => {
                    let items: any[] = [];
                    try { items = JSON.parse((selectedOrder as any).items || '[]'); } catch {}
                    if (items.length > 0) {
                      return items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/20 last:border-0">
                          <div>
                            <p className="text-sm font-medium">{item.productName}</p>
                            {item.variantLabel && <p className="text-xs text-muted-foreground">{item.variantLabel}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono">{cur(selectedOrder)}{item.price} × {item.qty}</p>
                            <p className="text-xs text-muted-foreground">{cur(selectedOrder)}{(item.price * item.qty).toFixed(0)}</p>
                          </div>
                        </div>
                      ));
                    }
                    return <p className="text-sm">{selectedOrder.productName || '—'}</p>;
                  })()}
                  <div className="flex justify-between items-center pt-2 border-t border-border/30">
                    <span className="text-sm font-semibold">{isAr ? 'المجموع' : 'Total'}</span>
                    <span className="text-lg font-bold font-mono text-primary">{cur(selectedOrder)}{selectedOrder.amount}</span>
                  </div>
                </div>

                {/* Payment & Notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{isAr ? 'الدفع' : 'Payment'}</p>
                    </div>
                    <p className="text-sm font-medium">
                      {(selectedOrder as any).paymentMethod === 'card' ? (isAr ? 'بطاقة' : 'Card') : (isAr ? 'عند الاستلام' : 'Cash on Delivery')}
                    </p>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{isAr ? 'التاريخ' : 'Date'}</p>
                    </div>
                    <p className="text-sm font-mono">{selectedOrder.date}</p>
                  </div>
                </div>

                {(selectedOrder as any).notes && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                      <p className="text-xs text-amber-400">{isAr ? 'ملاحظات' : 'Notes'}</p>
                    </div>
                    <p className="text-sm">{(selectedOrder as any).notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <a href={`https://wa.me/${selectedOrder.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(`مرحباً ${selectedOrder.customerName}، بخصوص طلبك رقم ${selectedOrder.id}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg py-2.5 text-xs font-medium transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {isAr ? 'تواصل عبر واتساب' : 'Contact via WhatsApp'}
                  </a>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-medium border transition-colors ${statusConfig[selectedOrder.status].className}`}>
                        <Package className="w-3.5 h-3.5" />
                        {isAr ? 'تغيير الحالة' : 'Change Status'}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-popover border-border">
                      {(Object.keys(statusConfig) as OrderStatus[]).map(s => (
                        <DropdownMenuItem key={s} onClick={() => handleStatusChange(selectedOrder.id, s)} className="cursor-pointer">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border me-2 ${statusConfig[s].className}`}>
                            {isAr ? statusConfig[s].ar : statusConfig[s].en}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
