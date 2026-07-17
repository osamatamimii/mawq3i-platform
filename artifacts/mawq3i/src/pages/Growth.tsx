import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { adminRest, supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import {
  Brain, Package, ShoppingCart, Store as StoreIcon, Loader2, Check, X, Zap,
  ArrowUpRight, ArrowDownRight, Minus, Radio, Megaphone, Link2, ShieldCheck,
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
}

interface AdAccount {
  id: string;
  platform: 'meta' | 'tiktok';
  external_account_name: string;
  status: string;
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

function daysAgoISO(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function Growth() {
  const { language, currentStore } = useAppContext();
  const { toast } = useToast();
  const isAr = language === 'ar';

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<GrowthEvent[]>([]);
  const [plan, setPlan] = useState<GrowthPlan | null>(null);
  const [weekStats, setWeekStats] = useState({ views: 0, purchases: 0, revenue: 0 });
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [adLoading, setAdLoading] = useState(true);
  const [connecting, setConnecting] = useState<'meta' | 'tiktok' | null>(null);

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
  const fetchWeekStats = async () => {
    if (!currentStore?.id) return;
    const since = daysAgoISO(7);
    const rows = await adminRest.select('product_daily_stats', `store_id=eq.${currentStore.id}&stat_date=gte.${since}&select=views,purchases,revenue`, currentStore.id);
    const arr = Array.isArray(rows) ? rows : [];
    setWeekStats({
      views: arr.reduce((s: number, r: any) => s + (r.views || 0), 0),
      purchases: arr.reduce((s: number, r: any) => s + (r.purchases || 0), 0),
      revenue: arr.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0),
    });
  };
  const fetchAdAccounts = async () => {
    if (!currentStore?.id) return;
    const { data } = await supabase.from('ad_accounts').select('id, platform, external_account_name, status').eq('store_id', currentStore.id);
    setAdAccounts(data || []);
    setAdLoading(false);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchEvents(), fetchPlan(), fetchWeekStats(), fetchAdAccounts()]);
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

  const connectAd = async (platform: 'meta' | 'tiktok') => {
    setConnecting(platform);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken || !currentStore?.id) { toast({ title: isAr ? 'سجّل دخولك من جديد' : 'Please sign in again', variant: 'destructive' }); return; }
      const res = await fetch(`/api/growth-agent?action=oauth-start&platform=${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ store_id: currentStore.id }),
      });
      const data = await res.json();
      if (!data.configured) {
        toast({ title: isAr ? 'هاي الميزة لسا ما اتفعّلت' : 'Not available yet', description: data.message, variant: 'destructive' });
        return;
      }
      window.location.href = data.authUrl;
    } catch {
      toast({ title: isAr ? 'صار خطأ، حاول لاحقاً' : 'Something went wrong', variant: 'destructive' });
    } finally {
      setConnecting(null);
    }
  };

  const platformLabel = (p: string) => (p === 'meta' ? 'Meta (فيسبوك/إنستغرام)' : 'TikTok');
  const adStatusBadge = (s: string) => {
    const map: Record<string, { ar: string; en: string; cls: string }> = {
      connected: { ar: 'مربوط ونشط', en: 'Connected', cls: 'bg-primary/15 text-primary' },
      expired: { ar: 'انتهت الصلاحية، أعد الربط', en: 'Expired, reconnect', cls: 'bg-red-500/15 text-red-400' },
      revoked: { ar: 'مُلغى', en: 'Revoked', cls: 'bg-muted text-muted-foreground' },
    };
    const m = map[s] || map.connected;
    return <span className={`text-xs rounded-full px-2 py-0.5 ${m.cls}`}>{isAr ? m.ar : m.en}</span>;
  };

  const activeCount = events.filter((e) => e.event_type === 'suggested_action' && e.status === 'pending').length;

  // بريفنغ الخبير: خطة شهرية إن وُجدت، وإلا نص حي مبني من بيانات آخر 7 أيام
  const liveBriefing = (() => {
    if (plan) return plan.summary;
    if (weekStats.views === 0 && weekStats.purchases === 0) {
      return isAr
        ? 'لسا عم أجمع بيانات عن متجرك. خلال أيام قليلة رح يصير عندي صورة كافية أقيّم فيها أداءك وأبني خطة نمو مخصصة إلك.'
        : "Still gathering data on your store. Within a few days I'll have enough to assess performance and build a tailored growth plan.";
    }
    return isAr
      ? `راقبت متجرك آخر 7 أيام: ${weekStats.views} مشاهدة و${weekStats.purchases} مبيعة، بإيراد ${weekStats.revenue.toLocaleString()}. لسا ما لقيت مشكلة تستاهل تدخّل فوري — بس بواصل الفحص يومياً، وأول ما ألقى شي، بحطه هون فوراً.`
      : `I reviewed your store over the last 7 days: ${weekStats.views} views, ${weekStats.purchases} sales, ${weekStats.revenue.toLocaleString()} revenue. Nothing urgent yet — I keep checking daily and will flag anything the moment it matters.`;
  })();

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      {/* هوية الخبير — هيدر مختلف تماماً عن باقي الصفحات */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1a0f] via-[#0e1f12] to-[#132a16] border border-primary/20 p-6 text-white">
        <div className="absolute -top-16 -end-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
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
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {isAr ? 'يراقب متجرك الآن' : 'Monitoring your store'}
              </span>
            </div>
            <p className="text-sm text-white/80 mt-2 leading-relaxed">{liveBriefing}</p>
            {plan && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {(() => { const st = STAGE_STYLE[plan.stage] || STAGE_STYLE.steady_growth; const Icon = st.icon; return (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${st.cls}`}>
                    <Icon className="w-3.5 h-3.5" />{plan.stage_label_ar}
                  </span>
                ); })()}
                <span className="text-[11px] text-white/50">{plan.period_start} → {plan.period_end}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* أولويات الخبير من الخطة الشهرية */}
      {plan?.priorities?.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">{isAr ? 'أولوياتك هالشهر حسب خبير النمو' : "This month's priorities from your growth expert"}</p>
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

      {/* إجراءات بانتظار قرارك */}
      {activeCount > 0 && (
        <p className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          {isAr ? `${activeCount} إجراء بانتظار قرارك` : `${activeCount} action awaiting your decision`}
        </p>
      )}

      {events.length > 0 && (
        <div className="space-y-2">
          {events.map((e) => {
            const Icon = CATEGORY_ICON[e.category] || Brain;
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
                      <Zap className="w-3 h-3" />{isAr ? 'نفّذته بنفسي — قابل للتراجع من صفحة المنتجات' : 'I executed this — reversible from Products page'}
                    </span>
                  )}
                  {e.event_type === 'suggested_action' && e.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" disabled={decidingId === e.id} onClick={() => decide(e.id, 'approve')}>
                        {decidingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : <Check className="w-3.5 h-3.5 me-1.5" />}
                        {isAr ? 'موافق، نفّذ' : 'Approve'}
                      </Button>
                      <Button size="sm" variant="outline" disabled={decidingId === e.id} onClick={() => decide(e.id, 'reject')}>
                        <X className="w-3.5 h-3.5 me-1.5" />{isAr ? 'رفض' : 'Reject'}
                      </Button>
                    </div>
                  )}
                  {e.event_type === 'suggested_action' && e.status === 'approved' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 rounded-full px-2 py-0.5 mt-2"><Check className="w-3 h-3" />{isAr ? 'وافقت ونُفّذ' : 'Approved & executed'}</span>
                  )}
                  {e.event_type === 'suggested_action' && e.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 mt-2"><X className="w-3 h-3" />{isAr ? 'رُفض' : 'Rejected'}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ربط مصادر البيانات — Meta / TikTok Ads */}
      <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">{isAr ? 'وسّع صلاحيات خبير النمو' : "Expand your growth expert's reach"}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isAr
            ? 'اربط حسابات إعلاناتك عشان أقدر أشخّص أداء حملاتك (نسبة النقر، الصرف، مقارنة بمعايير السوق) — مش بس أداء متجرك الداخلي.'
            : "Connect your ad accounts so I can diagnose campaign performance (CTR, spend, vs. market benchmarks) — not just your store's internal metrics."}
        </p>
        {adLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : adAccounts.length > 0 ? (
          <div className="space-y-2">
            {adAccounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{platformLabel(a.platform)}</p>
                    <p className="text-xs text-muted-foreground">{a.external_account_name}</p>
                  </div>
                </div>
                {adStatusBadge(a.status)}
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!adAccounts.some((a) => a.platform === 'meta' && a.status === 'connected') && (
            <Button variant="outline" size="sm" disabled={connecting === 'meta'} onClick={() => connectAd('meta')}>
              {connecting === 'meta' ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : null}
              {isAr ? 'ربط حساب Meta الإعلاني' : 'Connect Meta Ads'}
            </Button>
          )}
          {!adAccounts.some((a) => a.platform === 'tiktok' && a.status === 'connected') && (
            <Button variant="outline" size="sm" disabled={connecting === 'tiktok'} onClick={() => connectAd('tiktok')}>
              {connecting === 'tiktok' ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : null}
              {isAr ? 'ربط حساب TikTok الإعلاني' : 'Connect TikTok Ads'}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
