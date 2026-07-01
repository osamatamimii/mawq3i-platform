import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getOrders, getProducts } from '@/lib/db';
import { Order, Product } from '@/data/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, Loader2, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

const SUGGESTED_PROMPTS_AR = [
  'ما هي أفضل 3 أفكار لزيادة مبيعاتي هالأسبوع؟',
  'أي منتج عندي راكد وكيف أحركه؟',
  'اقترح عرض أو خصم مناسب لمتجري الآن',
];
const SUGGESTED_PROMPTS_EN = [
  'What are the top 3 ideas to boost my sales this week?',
  'Which product is stagnant and how do I move it?',
  'Suggest a discount or promotion for my store right now',
];

function buildStoreSummary(products: Product[], orders: Order[], isAr: boolean): string {
  const lowStock = products.filter((p) => (p.stock ?? 0) <= 3);
  const topProducts = [...products]
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, 15);

  const now = Date.now();
  const last30d = orders.filter((o) => {
    const t = new Date(o.date).getTime();
    return !isNaN(t) && now - t <= 30 * 24 * 60 * 60 * 1000;
  });
  const salesByProduct: Record<string, number> = {};
  last30d.forEach((o) => {
    if (o.status === 'cancelled') return;
    if (o.items && o.items.length > 0) {
      o.items.forEach((it) => {
        salesByProduct[it.productName] = (salesByProduct[it.productName] || 0) + (it.quantity || 1);
      });
    } else if (o.productName) {
      salesByProduct[o.productName] = (salesByProduct[o.productName] || 0) + 1;
    }
  });

  const lines: string[] = [];
  lines.push(isAr ? `عدد المنتجات: ${products.length}` : `Total products: ${products.length}`);
  lines.push(
    isAr
      ? `عدد الطلبات آخر 30 يوم: ${last30d.length} (ملغاة: ${last30d.filter((o) => o.status === 'cancelled').length})`
      : `Orders last 30 days: ${last30d.length} (cancelled: ${last30d.filter((o) => o.status === 'cancelled').length})`
  );

  lines.push(isAr ? '\nقائمة المنتجات (اسم / سعر / مخزون / مبيعات آخر 30 يوم):' : '\nProducts (name / price / stock / sales last 30d):');
  topProducts.forEach((p) => {
    const name = p.nameAr || p.nameEn || '—';
    const sales = salesByProduct[name] || 0;
    lines.push(`- ${name} | ${p.price} ${p.currency || ''} | ${isAr ? 'مخزون' : 'stock'}: ${p.stock ?? '—'} | ${isAr ? 'مبيعات' : 'sold'}: ${sales}`);
  });

  if (lowStock.length > 0) {
    lines.push(isAr ? '\nمنتجات مخزونها منخفض جداً (3 أو أقل):' : '\nVery low stock (≤3):');
    lowStock.forEach((p) => {
      const name = p.nameAr || p.nameEn || '—';
      lines.push(`- ${name} (${p.stock ?? 0})`);
    });
  }

  return lines.join('\n');
}

export default function AIAdvisor() {
  const { language, currentStore, isAdminMode } = useAppContext();
  const isAr = language === 'ar';

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      getProducts(currentStore?.id, isAdminMode),
      getOrders(currentStore?.id, isAdminMode),
    ]).then(([p, o]) => {
      setProducts(p);
      setOrders(o);
      setDataLoading(false);
    });
  }, [currentStore?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const summary = useMemo(() => buildStoreSummary(products, orders, isAr), [products, orders, isAr]);
  const suggested = isAr ? SUGGESTED_PROMPTS_AR : SUGGESTED_PROMPTS_EN;

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending || !currentStore) return;

    setError('');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: currentStore.id,
          storeName: currentStore.name,
          summary,
          messages: nextMessages,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Request failed');
      setMessages((prev) => [...prev, { role: 'model', content: data.reply }]);
    } catch (err: any) {
      setError(isAr ? 'حدث خطأ، حاول مرة ثانية.' : 'Something went wrong, please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-6rem)]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-4"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isAr ? 'المستشار الذكي' : 'AI Advisor'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? 'اسأل أي سؤال عن متجرك ومبيعاتك' : 'Ask anything about your store and sales'}
          </p>
        </div>
      </motion.div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !dataLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {isAr
                    ? 'مرحباً! أنا مستشارك التسويقي. اسألني عن منتجاتك، مبيعاتك، أو كيف تزيد أرباحك.'
                    : "Hi! I'm your marketing advisor. Ask me about your products, sales, or how to grow revenue."}
                </p>
                <div className="flex flex-col gap-2 w-full max-w-sm">
                  {suggested.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-sm text-start px-4 py-2.5 rounded-lg border border-border/60 bg-card/60 hover:border-primary/40 hover:bg-primary/5 transition-colors text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dataLoading && (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('flex gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {m.role === 'model' && (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-card/80 border border-border/60 text-foreground rounded-tl-sm'
                    )}
                  >
                    {m.content}
                  </div>
                  {m.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {sending && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-card/80 border border-border/60 rounded-2xl rounded-tl-sm px-4 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="border-t border-border/60 p-3 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isAr ? 'اكتب سؤالك هنا...' : 'Type your question...'}
              disabled={sending || dataLoading}
              className="flex-1 h-11 rounded-lg bg-card/60 border border-border/60 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all disabled:opacity-50"
            />
            <Button type="submit" size="icon" disabled={sending || dataLoading || !input.trim()} className="h-11 w-11 flex-shrink-0">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
