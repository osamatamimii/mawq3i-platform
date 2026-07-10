import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, Loader2, User, PackageSearch, ShoppingCart, TrendingUp, Tag, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataCard {
  tool: string;
  items?: any[];
  stats?: any;
}
interface PendingAction {
  type: 'update_product' | 'create_promotion' | 'update_promotion';
  params: Record<string, any>;
}
interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  dataCards?: DataCard[];
  pendingAction?: PendingAction | null;
  actionState?: 'pending' | 'confirmed' | 'cancelled';
}

const SUGGESTED_PROMPTS_AR = [
  'وش المنتجات اللي مخزونها منخفض؟',
  'اعرض لي آخر 10 طلبات',
  'كيف أداء مبيعاتي آخر 30 يوم؟',
  'أنشئ بنر عرض لتخفيضات نهاية الأسبوع',
];
const SUGGESTED_PROMPTS_EN = [
  'Which products are low on stock?',
  'Show me the last 10 orders',
  'How were my sales over the last 30 days?',
  'Create a weekend sale banner',
];

function actionSummary(action: PendingAction, isAr: boolean): { title: string; lines: string[] } {
  const p = action.params;
  if (action.type === 'create_promotion') {
    return {
      title: isAr ? `🎟️ عرض جديد: ${p.title_ar || ''}` : `🎟️ New promo: ${p.title_ar || ''}`,
      lines: [p.discount_text, p.subtitle_ar, p.expires_at ? `${isAr ? 'ينتهي' : 'expires'}: ${p.expires_at}` : ''].filter(Boolean),
    };
  }
  if (action.type === 'update_promotion') {
    return {
      title: isAr ? `✏️ تعديل عرض` : `✏️ Edit promo`,
      lines: Object.entries(p).filter(([k]) => k !== 'promotion_id').map(([k, v]) => `${k}: ${v}`),
    };
  }
  return {
    title: isAr ? `✏️ تعديل منتج` : `✏️ Edit product`,
    lines: Object.entries(p).filter(([k]) => k !== 'product_id').map(([k, v]) => `${k}: ${v}`),
  };
}

function DataCardView({ card, isAr }: { card: DataCard; isAr: boolean }) {
  if (card.tool === 'get_low_stock_products' || card.tool === 'search_products') {
    return (
      <div className="mt-2 rounded-xl border border-border/60 bg-card/50 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-background/40">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><PackageSearch className="w-3.5 h-3.5" />{isAr ? 'منتجات' : 'Products'}</span>
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{card.items?.length}</span>
        </div>
        {card.items?.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between px-3 py-2 border-b border-border/40 last:border-0 text-xs">
            <div className="min-w-0">
              <div className="font-semibold truncate">{p.name_ar}</div>
              {p.price != null && <div className="text-[10px] text-muted-foreground">{p.price}</div>}
            </div>
            {p.stock != null && (
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                p.stock <= 0 ? 'text-red-400 bg-red-500/10' : 'text-orange-400 bg-orange-500/10')}>
                {p.stock <= 0 ? (isAr ? 'نفذ' : 'Out') : `${isAr ? 'متبقي' : 'left'} ${p.stock}`}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (card.tool === 'get_recent_orders') {
    return (
      <div className="mt-2 rounded-xl border border-border/60 bg-card/50 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-background/40">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5" />{isAr ? 'الطلبات' : 'Orders'}</span>
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{card.items?.length}</span>
        </div>
        {card.items?.map((o: any) => (
          <div key={o.id} className="flex items-center justify-between px-3 py-2 border-b border-border/40 last:border-0 text-xs">
            <div className="min-w-0"><div className="font-semibold truncate">{o.customer_name || '—'}</div><div className="text-[10px] text-muted-foreground">{o.date}</div></div>
            <div className="text-end flex-shrink-0"><div className="font-bold">{o.amount}</div><div className="text-[10px] text-muted-foreground">{o.status}</div></div>
          </div>
        ))}
      </div>
    );
  }
  if (card.tool === 'get_sales_stats' && card.stats) {
    const s = card.stats;
    return (
      <div className="mt-2 rounded-xl border border-border/60 bg-card/50 p-3">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-muted-foreground"><TrendingUp className="w-3.5 h-3.5" />{isAr ? `آخر ${s.period_days} يوم` : `Last ${s.period_days} days`}</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-base font-black text-primary">{s.order_count}</div><div className="text-[10px] text-muted-foreground">{isAr ? 'طلب' : 'orders'}</div></div>
          <div><div className="text-base font-black text-primary">{s.revenue}</div><div className="text-[10px] text-muted-foreground">{isAr ? 'مبيعات' : 'revenue'}</div></div>
          <div><div className="text-base font-black text-primary">{s.cancelled_count}</div><div className="text-[10px] text-muted-foreground">{isAr ? 'ملغى' : 'cancelled'}</div></div>
        </div>
        {s.top_product && <div className="mt-2 text-[11px] text-center text-muted-foreground">{isAr ? 'الأكثر مبيعاً:' : 'Top seller:'} <span className="text-foreground font-semibold">{s.top_product.name}</span></div>}
      </div>
    );
  }
  if (card.tool === 'get_promotions') {
    return (
      <div className="mt-2 rounded-xl border border-border/60 bg-card/50 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-background/40">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" />{isAr ? 'العروض' : 'Promotions'}</span>
        </div>
        {card.items?.map((p: any) => (
          <div key={p.id} className="px-3 py-2 border-b border-border/40 last:border-0 text-xs">
            <div className="font-semibold">{p.title_ar}</div>
            <div className="text-[10px] text-muted-foreground">{p.discount_text} {p.is_active ? '' : (isAr ? '· غير مفعّل' : '· inactive')}</div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function AIAdvisor() {
  const { language, currentStore } = useAppContext();
  const isAr = language === 'ar';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

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
      const res = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: currentStore.id,
          storeName: currentStore.name,
          messages: nextMessages,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Request failed');
      setMessages((prev) => [...prev, {
        role: 'model',
        content: data.reply || '',
        dataCards: data.dataCards || [],
        pendingAction: data.pendingAction || null,
        actionState: data.pendingAction ? 'pending' : undefined,
      }]);
    } catch (err: any) {
      setError(isAr ? 'حدث خطأ، حاول مرة ثانية.' : 'Something went wrong, please try again.');
    } finally {
      setSending(false);
    }
  }

  async function confirmAction(msgIndex: number) {
    const msg = messages[msgIndex];
    if (!msg.pendingAction || !currentStore) return;
    setMessages((prev) => prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'confirmed' } : m));
    try {
      const res = await fetch('/api/ai-agent-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: currentStore.id, type: msg.pendingAction.type, params: msg.pendingAction.params }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Execution failed');
      setMessages((prev) => [...prev, { role: 'model', content: isAr ? '✅ تم بنجاح.' : '✅ Done.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'model', content: isAr ? '❌ صار خطأ أثناء التنفيذ.' : '❌ Something went wrong executing this.' }]);
    }
  }

  function cancelAction(msgIndex: number) {
    setMessages((prev) => prev.map((m, i) => i === msgIndex ? { ...m, actionState: 'cancelled' } : m));
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-6rem)]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-primary/15 mb-4 px-6 py-5 text-center flex-shrink-0"
        style={{
          background: 'radial-gradient(circle at 25% 15%, rgba(82,255,63,.16), transparent 55%), radial-gradient(circle at 80% 85%, rgba(82,255,63,.08), transparent 50%)',
        }}
      >
        <div className="w-12 h-12 mx-auto mb-2 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary to-primary/70 shadow-[0_0_30px_rgba(82,255,63,0.45)]">
          <Sparkles className="w-6 h-6 text-background" />
        </div>
        <h1 className="text-lg font-black text-foreground">{isAr ? 'المستشار الذكي' : 'AI Advisor'}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isAr ? 'يدير متجرك من نفس المحادثة — يستعلم، يحلل، وينفّذ' : 'Runs your store from this chat — queries, analyzes, and executes'}
        </p>
      </motion.div>

      <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 themed-scroll">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
              <p className="text-sm text-muted-foreground max-w-sm">
                {isAr
                  ? 'اسألني عن مخزونك، طلباتك، أو مبيعاتك — أو اطلب مني أعدّل منتج، أنشئ عرض، أو أي إجراء تاني بمتجرك.'
                  : "Ask about your stock, orders, or sales — or ask me to edit a product, create a promo, or take any other action."}
              </p>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {suggested.map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="text-sm text-start px-4 py-2.5 rounded-lg border border-border/60 bg-card/60 hover:border-primary/40 hover:bg-primary/5 transition-colors text-foreground">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={cn('flex flex-col gap-1', m.role === 'user' ? 'items-end' : 'items-start')}>
                <div className={cn('flex gap-3 w-full', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {m.role === 'model' && (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={cn('max-w-[85%] flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
                    <div className={cn('rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                      m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card/80 border border-border/60 text-foreground rounded-tl-sm')}>
                      {m.content}
                    </div>
                    {m.dataCards?.map((c, ci) => <DataCardView key={ci} card={c} isAr={isAr} />)}
                    {m.pendingAction && (
                      <div className={cn('mt-2 w-full rounded-xl border p-3 flex flex-col gap-2',
                        m.actionState === 'confirmed' ? 'border-primary/40 bg-primary/5' :
                        m.actionState === 'cancelled' ? 'border-border/40 bg-background/30 opacity-50' :
                        'border-primary/30 bg-primary/5')}>
                        {(() => { const s = actionSummary(m.pendingAction, isAr); return (
                          <>
                            <div className="text-xs font-bold text-primary">{s.title}</div>
                            {s.lines.length > 0 && <div className="text-[11px] text-muted-foreground">{s.lines.join(' · ')}</div>}
                          </>
                        ); })()}
                        {m.actionState === 'pending' && (
                          <div className="flex gap-2 mt-1">
                            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => confirmAction(i)}><Check className="w-3.5 h-3.5" />{isAr ? 'تأكيد' : 'Confirm'}</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => cancelAction(i)}><X className="w-3.5 h-3.5" />{isAr ? 'إلغاء' : 'Cancel'}</Button>
                          </div>
                        )}
                        {m.actionState === 'confirmed' && <div className="text-[11px] text-primary font-semibold">{isAr ? '⏳ جاري التنفيذ...' : '⏳ Executing...'}</div>}
                        {m.actionState === 'cancelled' && <div className="text-[11px] text-muted-foreground">{isAr ? 'أُلغي' : 'Cancelled'}</div>}
                      </div>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card/80 border border-border/60 rounded-2xl rounded-tl-sm px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="border-t border-border/60 p-3 flex items-center gap-2 flex-shrink-0">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isAr ? 'اكتب طلبك هنا...' : 'Type your request...'}
            disabled={sending}
            className="flex-1 h-11 rounded-lg bg-card/60 border border-border/60 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all disabled:opacity-50"
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()} className="h-11 w-11 flex-shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
