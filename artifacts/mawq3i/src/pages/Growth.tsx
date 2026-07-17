import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { adminRest, supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { TrendingUp, Package, ShoppingCart, Store as StoreIcon, Loader2, Check, X, Zap, Sparkles, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface GrowthPlan {
  id: string;
  stage: string;
  stage_label_ar: string;
  summary: string;
  priorities: { title: string; description: string; category: string }[];
  metrics: Record<string, any>;
  period_start: string;
  period_end: string;
}

interface GrowthEvent {
  id: string;
  event_type: 'diagnosis' | 'suggested_action' | 'auto_action' | string;
  category: 'product' | 'store' | 'cart' | 'ad' | string;
  title: string;
  description: string;
  related_product_id: string | null;
  created_at: string;
  status: string;
}

const CATEGORY_ICON: Record<string, any> = {
  product: Package,
  store: StoreIcon,
  cart: ShoppingCart,
};

const STAGE_STYLE: Record<string, { cls: string; icon: any }> = {
  launch: { cls: 'bg-blue-500/10 text-blue-500', icon: Sparkles },
  rapid_growth: { cls: 'bg-primary/10 text-primary', icon: ArrowUpRight },
  steady_growth: { cls: 'bg-primary/10 text-primary', icon: ArrowUpRight },
  plateau: { cls: 'bg-amber-500/10 text-amber-500', icon: Minus },
  decline: { cls: 'bg-red-500/10 text-red-500', icon: ArrowDownRight },
};

function timeAgo(dateStr: string, isAr: boolean) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (isAr) {
    if (diff < 3600) return `منذ ${Math.max(1, Math.floor(diff / 60))} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    return `منذ ${Math.floor(diff / 86400)} يوم`;
  }
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Growth() {
  const { language, currentStore } = useAppContext();
  const { toast } = useToast();
  const isAr = language === 'ar';
  const [events, setEvents] = useState<GrowthEvent[]>([]);
  const [plan, setPlan] = useState<GrowthPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const fetchEvents = async () => {
    if (!currentStore?.id) return;
    const data = await adminRest.select(
      'store_growth_events',
      `store_id=eq.${currentStore.id}&order=created_at.desc&limit=50`,
      currentStore.id
    );
    setEvents(Array.isArray(data) ? data : []);
  };

  const fetchPlan = async () => {
    if (!currentStore?.id) return;
    const data = await adminRest.select(
      'store_growth_plans',
      `store_id=eq.${currentStore.id}&order=period_end.desc&limit=1`,
      currentStore.id
    );
    setPlan(Array.isArray(data) && data.length ? data[0] : null);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchEvents(), fetchPlan()]);
      setLoading(false);
    })();
  }, [currentStore?.id]);

  const decide = async (eventId: string, decision: 'approve' | 'reject') => {
    setDecidingId(eventId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { toast({ title: isAr ? 'سجّل دخولك من جديد' : 'Please sign in again', variant: 'destructive' }); return; }

      const res = await fetch('/api/growth-agent?action=execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ event_id: eventId, decision }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: isAr ? 'صار خطأ' : 'Something went wrong', description: err.error, variant: 'destructive' });
        return;
      }
      toast({ title: decision === 'approve' ? (isAr ? 'تم التنفيذ ✅' : 'Executed ✅') : (isAr ? 'تم الرفض' : 'Rejected') });
      await fetchEvents();
    } finally {
      setDecidingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          {isAr ? 'النمو' : 'Growth'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? 'وكيل النمو بيراقب متجرك يومياً ويطلعلك هون أي شي يستاهل انتباهك — منتج راكد، صفحة منتج ما بتحوّل، أو سلات متروكة أكتر من الطبيعي.'
            : 'The growth agent watches your store daily and surfaces anything worth your attention here — a stagnant product, a page that isn\'t converting, or unusually high cart abandonment.'}
        </p>
      </div>

      {plan && (() => {
        const style = STAGE_STYLE[plan.stage] || STAGE_STYLE.steady_growth;
        const StageIcon = style.icon;
        return (
          <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold rounded-full px-3 py-1 ${style.cls}`}>
                  <StageIcon className="w-4 h-4" />
                  {plan.stage_label_ar}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isAr ? `تقرير ${plan.period_start} → ${plan.period_end}` : `Report ${plan.period_start} → ${plan.period_end}`}
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed">{plan.summary}</p>
            {plan.priorities?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{isAr ? 'أولويات هالشهر' : "This month's priorities"}</p>
                <div className="space-y-2">
                  {plan.priorities.map((p, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {events.length > 0 && (
        <p className="text-xs font-semibold text-muted-foreground pt-2">{isAr ? 'آخر الملاحظات اليومية' : 'Recent daily notes'}</p>
      )}

      {events.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-card p-8 text-center">
          <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'ما في شي يستاهل انتباهك هلأ. وكيل النمو بيفحص متجرك يومياً وبيحطلك هون أي ملاحظة مهمة.'
              : 'Nothing needs your attention right now. The growth agent checks your store daily and will post here when something matters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const Icon = CATEGORY_ICON[e.category] || TrendingUp;
            return (
              <div key={e.id} className="rounded-xl border border-border/40 bg-card p-4 flex gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{e.title}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(e.created_at, isAr)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{e.description}</p>

                  {e.event_type === 'auto_action' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 rounded-full px-2 py-0.5 mt-2">
                      <Zap className="w-3 h-3" />
                      {isAr ? 'نُفّذ تلقائياً — قابل للتراجع من صفحة المنتجات' : 'Auto-executed — reversible from Products page'}
                    </span>
                  )}

                  {e.event_type === 'suggested_action' && e.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" disabled={decidingId === e.id} onClick={() => decide(e.id, 'approve')}>
                        {decidingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : <Check className="w-3.5 h-3.5 me-1.5" />}
                        {isAr ? 'موافق، نفّذ' : 'Approve'}
                      </Button>
                      <Button size="sm" variant="outline" disabled={decidingId === e.id} onClick={() => decide(e.id, 'reject')}>
                        <X className="w-3.5 h-3.5 me-1.5" />
                        {isAr ? 'رفض' : 'Reject'}
                      </Button>
                    </div>
                  )}
                  {e.event_type === 'suggested_action' && e.status === 'approved' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 rounded-full px-2 py-0.5 mt-2">
                      <Check className="w-3 h-3" />{isAr ? 'وافقت ونُفّذ' : 'Approved & executed'}
                    </span>
                  )}
                  {e.event_type === 'suggested_action' && e.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 mt-2">
                      <X className="w-3 h-3" />{isAr ? 'رُفض' : 'Rejected'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
