// Notification system for Mawq3i
// Uses browser notifications + WhatsApp link

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function sendBrowserNotification(title: string, body: string, icon?: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
    });
  }
}

export function sendOrderNotification(orderDetails: {
  orderId: string;
  customerName: string;
  productName: string;
  amount: number;
  currency: string;
  phone: string;
  paymentMethod: string;
}) {
  const cur = orderDetails.currency === 'SAR' ? '﷼' : '₪';
  const payMethod = orderDetails.paymentMethod === 'cod' ? 'عند الاستلام' : 'بطاقة';
  
  sendBrowserNotification(
    `🛍️ طلب جديد! ${orderDetails.orderId}`,
    `${orderDetails.customerName} — ${orderDetails.productName} — ${cur}${orderDetails.amount} (${payMethod})`
  );
}

// Poll for new orders every 30 seconds
let lastOrderId: string | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startOrderPolling(
  storeId: string,
  supabase: any,
  onNewOrder: (order: any) => void
) {
  if (pollInterval) clearInterval(pollInterval);
  
  pollInterval = setInterval(async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('id, customer_name, product_name, amount, currency, phone, payment_method, status')
        .eq('store_id', storeId)
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        const latest = data[0];
        if (lastOrderId && latest.id !== lastOrderId) {
          // New order!
          onNewOrder(latest);
          sendOrderNotification({
            orderId: latest.id,
            customerName: latest.customer_name,
            productName: latest.product_name,
            amount: latest.amount,
            currency: latest.currency,
            phone: latest.phone,
            paymentMethod: latest.payment_method,
          });
        }
        lastOrderId = latest.id;
      }
    } catch (e) {
      // Ignore polling errors
    }
  }, 30000); // Poll every 30s
  
  return () => { if (pollInterval) clearInterval(pollInterval); };
}
