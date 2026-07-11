import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Order, OrderStatus } from '@/data/mockData';
import { getOrders, updateOrderStatus } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Loader2, Bell, X, Phone, MapPin, CreditCard, Package, MessageSquare, Calendar, Tag, Truck, CheckCircle2, Search } from 'lucide-react';

const statusConfig: Record<OrderStatus, { ar: string; en: string; className: string }> = {
  new:        { ar: 'جديد',         en: 'New',        className: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30' },
  processing: { ar: 'قيد التجهيز', en: 'Processing',  className: 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30' },
  delivered:  { ar: 'تم التسليم',   en: 'Delivered',   className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' },
  cancelled:  { ar: 'ملغي',         en: 'Cancelled',   className: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' },
};

function DeliverySection({ order, storeId, isAr, onUpdated }: { order: Order; storeId: string; isAr: boolean; onUpdated: () => void }) {
  const [requesting, setRequesting] = useState(false);
  const [bids, setBids] = useState<any[] | null>(null);
  const [loadingBids, setLoadingBids] = useState(false);
  const [assigningBidId, setAssigningBidId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const provider = (order as any).deliveryProvider || 'self';
  const deliveryStatus = (order as any).togoDeliveryStatus;
  const togoDeliveryOrderId = (order as any).togoDeliveryOrderId;

  const fetchBids = async (togoOrderId: string) => {
    setLoadingBids(true);
    setError('');
    try {
      const res = await fetch(`/api/togo-delivery-bids?storeId=${storeId}&togoDeliveryOrderId=${togoOrderId}`);
      const data = await res.json();
      if (data.success) setBids(data.data?.items || data.data || []);
      else setError(data.message || (isAr ? 'تعذّر جلب العروض' : 'Could not load bids'));
    } catch {
      setError(isAr ? 'خطأ بالاتصال' : 'Connection error');
    } finally {
      setLoadingBids(false);
    }
  };

  useEffect(() => {
    if (provider === 'togo' && deliveryStatus === 'awaiting_bids' && togoDeliveryOrderId && bids === null) {
      fetchBids(togoDeliveryOrderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, deliveryStatus, togoDeliveryOrderId]);

  const requestDelivery = async () => {
    setRequesting(true);
    setError('');
    try {
      const res = await fetch('/api/togo-create-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, orderId: order.id }),
      });
      const data = await res.json();
      if (data.success) {
        onUpdated();
        await fetchBids(data.togoDeliveryOrderId);
      } else {
        setError(data.message || (isAr ? 'تعذّر طلب التوصيل' : 'Could not request delivery'));
      }
    } catch {
      setError(isAr ? 'خطأ بالاتصال' : 'Connection error');
    } finally {
      setRequesting(false);
    }
  };

  const assignBid = async (bid: any) => {
    setAssigningBidId(bid.id || bid.bid_id);
    setError('');
    try {
      const res = await fetch('/api/togo-delivery-bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId, orderId: order.id, togoDeliveryOrderId,
          bidId: bid.id || bid.bid_id,
          courierName: bid.company_name || bid.courier_name || bid.name,
          price: bid.price || bid.value,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onUpdated();
      } else {
        setError(data.message || (isAr ? 'تعذّر تعيين الشركة' : 'Could not assign courier'));
      }
    } catch {
      setError(isAr ? 'خطأ بالاتصال' : 'Connection error');
    } finally {
      setAssigningBidId(null);
    }
  };

  if (provider === 'togo' && deliveryStatus === 'assigned') {
    return (
      <div className="bg-white/[0.03] rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" />{isAr ? 'التوصيل' : 'Delivery'}
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-400">
              {isAr ? 'معيّنة لشركة ' : 'Assigned to '}{(order as any).togoCourierName || (isAr ? 'شركة توصيل' : 'a courier')}
            </p>
            {(order as any).togoDeliveryPrice != null && (
              <p className="text-xs text-muted-foreground">{isAr ? 'أجرة التوصيل: ' : 'Delivery fee: '}₪{(order as any).togoDeliveryPrice}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Truck className="w-3.5 h-3.5" />{isAr ? 'التوصيل' : 'Delivery'}
      </h3>

      {provider === 'self' && (
        <button onClick={requestDelivery} disabled={requesting}
          className="w-full flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg py-2.5 text-xs font-medium transition-colors disabled:opacity-50">
          {requesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
          {requesting ? (isAr ? 'جاري الطلب...' : 'Requesting...') : (isAr ? 'اطلب توصيل عبر Togo' : 'Request Togo delivery')}
        </button>
      )}

      {loadingBids && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{isAr ? 'جاري جلب عروض الشركات...' : 'Fetching courier offers...'}</p>
      )}

      {bids && bids.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{isAr ? 'اختر شركة التوصيل:' : 'Choose a courier:'}</p>
          {bids.map((b: any, i: number) => (
            <div key={b.id || b.bid_id || i} className="flex items-center justify-between bg-background/40 border border-border/50 rounded-lg px-3 py-2">
              <span className="text-xs font-medium">{b.company_name || b.courier_name || b.name || '—'} <span className="text-muted-foreground font-normal">— ₪{b.price || b.value}</span></span>
              <button disabled={assigningBidId !== null} onClick={() => assignBid(b)}
                className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50">
                {assigningBidId === (b.id || b.bid_id) ? <Loader2 className="w-3 h-3 animate-spin" /> : (isAr ? 'اختيار' : 'Select')}
              </button>
            </div>
          ))}
        </div>
      )}

      {bids && bids.length === 0 && !loadingBids && (
        <p className="text-xs text-muted-foreground">{isAr ? 'لا يوجد عروض حالياً، حاول لاحقاً' : 'No offers yet, try again shortly'}</p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function Orders() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Track last known order IDs to detect new ones
  const knownOrderIdsRef = useRef<Set<string> | null>(null);

  const sendWhatsAppToOwner = (order: Order) => {
    if (!currentStore?.owner_phone) return;
    const phone = currentStore.ownerPhone.replace(/\D/g, '');
    if (!phone) return;
    const cur = order.currency === 'ILS' ? '₪' : '﷼';
    const msg =
      `🛍️ طلب جديد!\n` +
      `رقم الطلب: ${order.id}\n` +
      `العميل: ${order.customerName}\n` +
      `الهاتف: ${order.phone}\n` +
      `المنتج: ${order.productName || '—'}\n` +
      `المبلغ: ${cur}${order.amount}\n` +
      `الدفع: ${(order as any).paymentMethod === 'card' ? 'بطاقة' : 'عند الاستلام'}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Load orders initially
  useEffect(() => {
    if (!currentStore?.id) return;
    getOrders(currentStore?.id, isAdminMode).then(data => {
      setOrders(data);
      // Initialize known IDs — don't fire WA on first load
      knownOrderIdsRef.current = new Set(data.map((o: Order) => o.id));
      setLoading(false);
    });
  }, [currentStore?.id]);

  // Poll every 30s for new orders
  useEffect(() => {
    if (!currentStore?.id) return;

    const poll = async () => {
      const fresh = await getOrders(currentStore.id, isAdminMode);
      if (!fresh || fresh.length === 0) return;

      // Detect new orders
      if (knownOrderIdsRef.current !== null) {
        const newOrders = fresh.filter(o => !knownOrderIdsRef.current!.has(o.id));
        if (newOrders.length > 0) {
          // Notify via WA for the first new order (avoid opening multiple tabs)
          sendWhatsAppToOwner(newOrders[0]);
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`🛍️ طلب جديد! ${newOrders[0].id}`, {
              body: `${newOrders[0].customerName} — ${newOrders[0].currency === 'ILS' ? '₪' : '﷼'}${newOrders[0].amount}`,
              icon: '/favicon.ico',
            });
          }
        }
      }

      knownOrderIdsRef.current = new Set(fresh.map(o => o.id));
      setOrders(fresh);
    };

    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [currentStore?.id, currentStore?.owner_phone]);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, status } : null);
    await updateOrderStatus(id, status, isAdminMode);
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

  const refreshOrder = async (id: string) => {
    if (!currentStore?.id) return;
    const data = await getOrders(currentStore.id, isAdminMode);
    setOrders(data);
    const fresh = data.find((o: Order) => o.id === id);
    if (fresh) setSelectedOrder(fresh);
  };

  const cur = (o: Order) => o.currency === 'ILS' ? '₪' : '﷼';

  const q = search.trim().toLowerCase();
  const filteredOrders = q
    ? orders.filter(o =>
        o.customerName?.toLowerCase().includes(q) ||
        o.phone?.toLowerCase().includes(q) ||
        o.id?.toLowerCase().includes(q) ||
        o.productName?.toLowerCase().includes(q)
      )
    : orders;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="bg-card border-border/50 shadow-lg">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-semibold">{isAr ? 'قائمة الطلبات' : 'Orders List'}</CardTitle>
              {orders.filter(o => o.status === 'new').length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Bell className="w-3 h-3" />
                  {orders.filter(o => o.status === 'new').length} {isAr ? 'جديد' : 'new'}
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isAr ? 'ابحث برقم الطلب أو اسم العميل أو الهاتف...' : 'Search by order ID, customer, or phone...'}
                className="h-8 w-64 ps-9 pe-8 text-xs bg-background/50 border-border/50"
                data-testid="input-search-orders"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={isAr ? 'مسح البحث' : 'Clear search'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {q ? (
              isAr ? `${filteredOrders.length} من ${orders.length} طلب` : `${filteredOrders.length} of ${orders.length} orders`
            ) : (
              <>{orders.length} {isAr ? 'طلب' : 'orders'}</>
            )}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
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
                ) : filteredOrders.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-7 h-7 text-muted-foreground/50" />
                      <p className="text-sm">{isAr ? 'لا توجد نتائج مطابقة' : 'No matching results'}</p>
                      <p className="text-xs opacity-60">{isAr ? 'جرّب كلمة بحث مختلفة' : 'Try a different search term'}</p>
                    </div>
                  </td></tr>
                ) : filteredOrders.map((order, i) => (
                  <motion.tr key={order.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="border-b border-border/30 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => setSelectedOrder(order)}>
                    <td className="px-6 py-4 font-mono text-xs text-primary font-bold">{order.id}</td>
                    <td className="px-6 py-4 font-medium">{order.customerName}</td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground" dir="ltr">{order.phone}</td>
                    <td className="px-6 py-4 text-sm max-w-[140px] truncate">{
                      order.productName
                        ? order.productName
                        : Array.isArray(order.items) && order.items.length > 0
                          ? (order.items[0] as any).productName || (order.items[0] as any).product_name || (order.items[0] as any).name || '—'
                          : '—'
                    }</td>
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
                    try {
                      const raw = (selectedOrder as any).items;
                      if (Array.isArray(raw)) items = raw;
                      else if (typeof raw === 'string' && raw) items = JSON.parse(raw);
                    } catch {}
                    if (items.length > 0) {
                      return items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/20 last:border-0">
                          <div>
                            <p className="text-sm font-medium">{item.name || item.productName || item.product_name || '—'}</p>
                            {item.variantLabel && <p className="text-xs text-muted-foreground">{item.variantLabel}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono">{cur(selectedOrder)}{item.price} × {item.qty || item.quantity || 1}</p>
                            <p className="text-xs text-muted-foreground">{cur(selectedOrder)}{(item.price * (item.qty || item.quantity || 1)).toFixed(0)}</p>
                          </div>
                        </div>
                      ));
                    }
                    return <p className="text-sm">{selectedOrder.productName || '—'}</p>;
                  })()}
                  {/* Discount breakdown */}
                  {(selectedOrder as any).discount_code && (selectedOrder as any).discount_amount > 0 && (() => {
                    const sub = (selectedOrder as any).items?.reduce((s: number, i: any) => s + (i.price * (i.qty || i.quantity || 1)), 0) || (selectedOrder.amount + (selectedOrder as any).discount_amount);
                    return (
                      <>
                        <div className="flex justify-between items-center pt-2 border-t border-border/30">
                          <span className="text-sm text-muted-foreground">{isAr ? 'المجموع الفرعي' : 'Subtotal'}</span>
                          <span className="text-sm font-mono text-muted-foreground">{cur(selectedOrder)}{sub.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-green-400 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            {isAr ? 'كود الخصم' : 'Discount'} · <span className="font-mono tracking-wider">{(selectedOrder as any).discount_code}</span>
                          </span>
                          <span className="text-sm font-mono text-green-400">- {cur(selectedOrder)}{Number((selectedOrder as any).discount_amount).toFixed(0)}</span>
                        </div>
                      </>
                    );
                  })()}
                  <div className="flex justify-between items-center pt-2 border-t border-border/30">
                    <span className="text-sm font-semibold">{isAr ? 'الإجمالي' : 'Total'}</span>
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
                    {(selectedOrder as any).paymentMethod === 'card' && (selectedOrder as any).paymentStatus && (
                      <span className={
                        'inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded ' +
                        ((selectedOrder as any).paymentStatus === 'awaiting_verification'
                          ? 'bg-amber-500/15 text-amber-400'
                          : (selectedOrder as any).paymentStatus === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : (selectedOrder as any).paymentStatus === 'cancelled'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-white/10 text-muted-foreground')
                      }>
                        {(selectedOrder as any).paymentStatus === 'awaiting_verification'
                          ? (isAr ? '⏳ بانتظار تأكيد الدفع' : '⏳ Awaiting confirmation')
                          : (selectedOrder as any).paymentStatus === 'paid'
                          ? (isAr ? '✅ تم الدفع' : '✅ Paid')
                          : (selectedOrder as any).paymentStatus === 'cancelled'
                          ? (isAr ? '❌ ألغيت' : '❌ Cancelled')
                          : (selectedOrder as any).paymentStatus}
                      </span>
                    )}
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{isAr ? 'التاريخ' : 'Date'}</p>
                    </div>
                    <p className="text-sm font-mono">{selectedOrder.date}</p>
                  </div>
                </div>

                <DeliverySection
                  order={selectedOrder}
                  storeId={currentStore?.id || ''}
                  isAr={isAr}
                  onUpdated={() => refreshOrder(selectedOrder.id)}
                />

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
