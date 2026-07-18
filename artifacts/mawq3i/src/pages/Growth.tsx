import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { adminRest, supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  Brain, Package, ShoppingCart, Store as StoreIcon, Loader2, Check, X, Zap,
  ArrowUpRight, ArrowDownRight, Minus, Radio, Megaphone, ExternalLink, Settings2, MessageCircle,
} from 'lucide-react';
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
  data?: { variant?: { field: string; original: string; suggested: string } };
  result_snapshot?: { pct_change: number | null; store_revenue_before: number; store_revenue_after: number } | null;
}

const CATEGORY_ICON: Record<string, any> = { product: Package, store: StoreIcon, cart: ShoppingCart, ad: Megaphone };
const STAGE_STYLE: Record<string, { cls: string; icon: any }> = {
  launch: { cls: 'bg-blue-500/15 text-blue-400', icon: Radio },
  rapid_growth: { cls: 'bg-primary/15 text-primary', icon: ArrowUpRight },
  steady_growth: { cls: 'bg-primary/15 text-primary', icon: ArrowUpRight },
  plateau: { cls: 'bg-amber-500/15 text-amber-400', icon: Minus },
  decline: { cls: 'bg-red-500/15 text-red-400', icon: ArrowDownRight },
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
function daysAgoISO(n: number) { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); }

function VariantPreview({ isAr, original, suggested }: { isAr: boolean; original: string; suggested: string }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5">
        <p className="text-[10px] font-semibold text-muted-foreground mb-1">{isAr ? 'الحالي' : 'Current'}</p>
        <p className="text-xs text-muted-foreground line-through decoration-muted-foreground/40">{original || (isAr ? '(فارغ)' : '(empty)')}</p>
      </div>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
        <p className="text-[10px] font-semibold text-primary mb-1">{isAr ? 'النسخة اللي اقترحتها' : 'My suggested version'}</p>
        <p className="text-xs">{suggested}</p>
      </div>
    </div>
  );
}

export default function Growth() {
  const { language, currentStore } = useAppContext();
  const { toast } = useToast();
  const isAr = language === 'ar';

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<GrowthEvent[]>([]);
  const [plan, setPlan] = useState<GrowthPlan | null>(null);
  const [hasEnoughData, setHasEnoughData] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(true);

  const fetchEvents = async () => {
    if (!currentStore?.id) return;
    const data = await adminRest.select('store_growth_events', `store_id=eq.${currentStore.id}&order=created_at.desc&limit=50`, currentStore.id);
    setEvents(Array.isArray(data) ? data : []);
  };
  const fetchPlan = async () => {
    if (!currentStore?.id) return;
    const data = await adminRest.select('store_growth_plans', `store_id=eq.${currentStore.id}&order=period_end.desc&limit=1`, currentStore.id);
    setPlan(Array.isArray(data) && data.length ? data[0] : null);
  };
  const fetchHasEnoughData = async () => {
    if (!currentStore?.id) return;
    const since = daysAgoISO(6);
    const rows = await adminRest.select('product_daily_stats', `store_id=eq.${currentStore.id}&stat_date=gte.${since}&limit=1&select=id`, currentStore.id);
    setHasEnoughData(Array.isArray(rows) && rows.length > 0);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchEvents(), fetchPlan(), fetchHasEnoughData()]);
      setLoading(false);
    })();
  }, [currentStore?.id]);

  useEffect(() => {
    if (plan) setShowExplainer(false);
  }, [plan]);

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

  const activeCount = events.filter((e) => e.event_type === 'suggested_action' && e.status === 'pending').length;

  const liveBriefing = (() => {
    if (plan) return plan.summary;
    if (!hasEnoughData) {
      return isAr
        ? 'لسا عم أجمع بيانات عن متجرك. خلال أيام قليلة رح يصير عندي صورة كافية أبدأ فيها أفحص وأتصرف.'
        : "Still gathering data on your store. Within a few days I'll have enough to start checking and acting.";
    }
    return isAr
      ? 'فحصت متجرك اليوم بكل قواعدي: منتجات راكدة، معدل التحويل، السلة المتروكة، وأداء الإعلانات. ما لقيت شي يستاهل قرار منك هلأ — رح أنبهك فوراً أول ما يصير في شي.'
      : "I checked your store today against all my rules: stagnant products, conversion rate, cart abandonment, ad performance. Nothing needs your decision right now — I'll alert you the moment something does.";
  })();

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      {/* هوية الخبير */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1a0f] via-[#0e1f12] to-[#132a16] border border-primary/20 p-6 text-white">
        <div className="absolute -top-16 -end-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <Link href="/dashboard/growth/connections" className="absolute top-4 end-4 text-white/50 hover:text-white/90 transition-colors" title={isAr ? 'إعدادات خبير النمو' : 'Growth Expert settings'}>
          <Settings2 className="w-4 h-4" />
        </Link>
        <div className="relative flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <span className="absolute -bottom-0.5 -end-0.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-[#0c1a0f]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold">{isAr ? 'خبير النمو' : 'Growth Expert'}</h1>
              <span className="text-[11px] text-primary/90 bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />{isAr ? 'يراقب متجرك الآن' : 'Monitoring your store'}
              </span>
            </div>
            <p className="text-sm text-white/80 mt-2 leading-relaxed">{liveBriefing}</p>
            <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {plan && (() => { const st = STAGE_STYLE[plan.stage] || STAGE_STYLE.steady_growth; const Icon = st.icon; return (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${st.cls}`}><Icon className="w-3.5 h-3.5" />{plan.stage_label_ar}</span>
                ); })()}
              </div>
              <a href="/dashboard/analytics" className="text-[11px] text-white/50 hover:text-white/80 transition-colors flex items-center gap-1">
                {isAr ? 'شوف الأرقام الكاملة بالإحصائيات' : 'See full numbers in Analytics'}<ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* شرح للتاجر: شو هو خبير النمو وكيف بيشتغل */}
      <div className="rounded-xl border border-border/40 bg-card p-5">
        <button
          type="button"
          onClick={() => setShowExplainer((v) => !v)}
          className="w-full flex items-center justify-between gap-3 text-start"
        >
          <span className="text-sm font-semibold flex items-center gap-2">
            <span className="text-base">💡</span>
            {isAr ? 'شو هو خبير النمو، وكيف بيشتغل؟' : 'What is the Growth Expert, and how does it work?'}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">{showExplainer ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'عرض' : 'Show')}</span>
        </button>
        {showExplainer && (
          <div className="mt-4 space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              {isAr
                ? 'خبير النمو بيفحص متجرك تلقائياً كل يوم — منتجات ما بتبيع، معدل التحويل، السلة المتروكة، وأداء إعلاناتك لو ربطتها. مش برنامج ثابت بيعطيك نفس النصيحة لكل الناس — بيبني كل قرار على أرقام متجرك الفعلية.'
                : "The Growth Expert checks your store automatically every day — stagnant products, conversion rate, cart abandonment, and your ad performance if connected. It's not generic advice — every decision is based on your store's actual numbers."}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/30 bg-muted/20 p-3">
                <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-primary" />{isAr ? 'بينفّذها لحاله' : 'It does automatically'}</p>
                <p className="text-xs">{isAr ? 'تغييرات صغيرة وآمنة — متل تحسين وصف منتج. دايماً قابلة للتراجع من صفحة المنتجات.' : 'Small, safe changes — like improving a product description. Always reversible from the Products page.'}</p>
              </div>
              <div className="rounded-lg border border-border/30 bg-muted/20 p-3">
                <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" />{isAr ? 'بينتظر موافقتك' : 'It waits for your approval'}</p>
                <p className="text-xs">{isAr ? 'أي قرار أكبر أثر — متل تغيير ميزانية إعلان أو إخفاء منتج — بيوقف وينتظر منك "موافق" أو "رفض".' : 'Anything with bigger impact — like changing an ad budget or hiding a product — waits for your "Approve" or "Reject".'}</p>
              </div>
            </div>
            <p>
              {isAr
                ? 'أول أسبوعين تقريباً بيمضيهم يجمع بيانات كافية عن متجرك قبل ما يبدأ يقترح شي. وكل شهر بيعطيك خطة أولويات جديدة حسب مرحلة نمو متجرك.'
                : "It spends roughly the first two weeks gathering enough data before suggesting anything. Every month it gives you a new set of priorities based on your store's growth stage."}
            </p>
            <Link href="/dashboard/growth/connections" className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium">
              {isAr ? 'شوف بالضبط شو بيراقب + اربط حسابات إعلاناتك' : 'See exactly what it monitors + connect your ad accounts'}<ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* أولويات الخبير */}
      {plan?.priorities?.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
          {plan.metrics?.next_month_goal?.label_ar && (
            <div className="flex items-center gap-2 pb-3 border-b border-border/30">
              <span className="text-lg">🎯</span>
              <p className="text-sm font-semibold">{plan.metrics.next_month_goal.label_ar}</p>
            </div>
          )}
          <p className="text-xs font-semibold text-muted-foreground">{isAr ? 'أولوياتك هالشهر حسب خبير النمو' : "This month's priorities from your growth expert"}</p>
          <div className="space-y-2">
            {plan.priorities.map((p, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <div><p className="text-sm font-medium">{p.title}</p><p className="text-xs text-muted-foreground">{p.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeCount > 0 && (
        <p className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />{isAr ? `${activeCount} إجراء بانتظار قرارك` : `${activeCount} action awaiting your decision`}
        </p>
      )}

      {events.length > 0 ? (
        <div className="space-y-2">
          {events.map((e) => {
            const Icon = CATEGORY_ICON[e.category] || Brain;
            return (
              <div key={e.id} className="rounded-xl border border-border/40 bg-card p-4 flex gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{e.title}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(e.created_at, isAr)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{e.description}</p>
                  {e.data?.variant && (
                    <VariantPreview isAr={isAr} original={e.data.variant.original} suggested={e.data.variant.suggested} />
                  )}
                  {e.event_type === 'auto_action' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 rounded-full px-2 py-0.5 mt-2"><Zap className="w-3 h-3" />{isAr ? 'نفّذته بنفسي — قابل للتراجع من صفحة المنتجات' : 'I executed this — reversible from Products page'}</span>
                  )}
                  {(e.status === 'approved' || e.status === 'auto_executed') && e.result_snapshot?.pct_change != null && (
                    <p className="text-[11px] mt-2 flex items-center gap-1">
                      <span className={e.result_snapshot.pct_change >= 0 ? 'text-primary' : 'text-red-400'}>
                        {e.result_snapshot.pct_change >= 0 ? '↑' : '↓'} {Math.abs(e.result_snapshot.pct_change).toFixed(0)}%
                      </span>
                      <span className="text-muted-foreground">{isAr ? 'تغيّر إيراد المتجر خلال أسبوع بعد هالقرار' : "store revenue change in the week after this decision"}</span>
                    </p>
                  )}
                  {e.event_type === 'suggested_action' && e.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" disabled={decidingId === e.id} onClick={() => decide(e.id, 'approve')}>
                        {decidingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : <Check className="w-3.5 h-3.5 me-1.5" />}{isAr ? 'موافق، نفّذ' : 'Approve'}
                      </Button>
                      <Button size="sm" variant="outline" disabled={decidingId === e.id} onClick={() => decide(e.id, 'reject')}><X className="w-3.5 h-3.5 me-1.5" />{isAr ? 'رفض' : 'Reject'}</Button>
                    </div>
                  )}
                  {e.event_type === 'suggested_action' && e.status === 'approved' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 rounded-full px-2 py-0.5 mt-2"><Check className="w-3 h-3" />{isAr ? 'وافقت ونُفّذ' : 'Approved & executed'}</span>
                  )}
                  {e.event_type === 'suggested_action' && e.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 mt-2"><X className="w-3 h-3" />{isAr ? 'رُفض' : 'Rejected'}</span>
                  )}
                  <Link
                    href={`/dashboard/ai-advisor?q=${encodeURIComponent(isAr ? `خبير النمو لاحظ هالشي بمتجري: "${e.title} — ${e.description}". شو رأيك وشو نصيحتك؟` : `My growth expert flagged this: "${e.title} — ${e.description}". What's your take and advice?`)}`}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors mt-2"
                  >
                    <MessageCircle className="w-3 h-3" />{isAr ? 'ناقشها مع المستشار الذكي' : 'Discuss with AI Advisor'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Link href="/dashboard/growth/connections" className="block rounded-xl border border-dashed border-border/50 p-5 text-center hover:border-primary/40 hover:bg-muted/30 transition-colors">
          <p className="text-xs text-muted-foreground">
            {isAr ? 'وسّع صلاحياتي بربط حسابات إعلاناتك — اضغط هون' : "Expand what I can do by connecting your ad accounts — tap here"}
          </p>
        </Link>
      )}
    </motion.div>
  );
}
