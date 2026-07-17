import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { adminRest, supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Package, ShoppingCart, Store as StoreIcon, Loader2, Check, X, Zap,
  ArrowUpRight, ArrowDownRight, Minus, Radio, Megaphone, Link2, ShieldCheck,
  Eye, ShoppingBag, DollarSign, ExternalLink, ChevronDown, KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
const WATCHLIST = [
  { icon: Package, ar: 'منتجات راكدة بدون مبيعات', en: 'Stagnant products with no sales' },
  { icon: StoreIcon, ar: 'معدل تحويل متجرك مقابل معايير السوق', en: "Your store's conversion vs. market benchmarks" },
  { icon: ShoppingCart, ar: 'نسبة التخلي عن السلة', en: 'Cart abandonment rate' },
  { icon: Megaphone, ar: 'أداء إعلاناتك (لو مربوطة)', en: 'Your ad performance (if connected)' },
];

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

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const w = 100, h = 28;
  const step = w / (points.length - 1);
  const coords = points.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-24 h-7" preserveAspectRatio="none">
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
    </svg>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-3 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-bold font-mono">{value}</p>
      </div>
    </div>
  );
}

function ManualConnectForm({ isAr, platform, currentStore, onConnected }: { isAr: boolean; platform: 'meta' | 'tiktok'; currentStore: any; onConnected: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!accountId.trim() || !accessToken.trim()) return;
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token || !currentStore?.id) { toast({ title: isAr ? 'سجّل دخولك من جديد' : 'Please sign in again', variant: 'destructive' }); return; }
      const res = await fetch('/api/growth-agent?action=connect-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ store_id: currentStore.id, platform, external_account_id: accountId.trim(), access_token: accessToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: isAr ? 'فشل الربط' : 'Connection failed', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: isAr ? `تم ربط ${data.account_name} ✅` : `Connected ${data.account_name} ✅` });
      setAccountId(''); setAccessToken(''); setOpen(false);
      onConnected();
    } catch {
      toast({ title: isAr ? 'صار خطأ، حاول لاحقاً' : 'Something went wrong', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const metaGuide = isAr
    ? ['روح لـ business.facebook.com وسجّل دخول', 'من الإعدادات → مستخدمو النظام (System Users)، أنشئ مستخدم جديد وأعطيه صلاحية على حسابك الإعلاني (ads_read)', 'ولّد توكن (Access Token) بصلاحية "لا ينتهي" (Never expire)', 'انسخ رقم حسابك الإعلاني (يبدأ بـ act_ أو أرقام فقط) والتوكن، وحطهم هون']
    : ['Go to business.facebook.com and sign in', 'Settings → System Users, create one and grant it ads_read on your ad account', 'Generate an access token set to never expire', 'Copy your ad account ID (starts with act_ or digits) and the token, paste them here'];
  const tiktokGuide = isAr
    ? ['روح لإعدادات TikTok Ads Manager الخاص فيك', 'دوّر على "API Access" أو "التطبيقات المصرّح لها"', 'ولّد Access Token طويل الأمد لحسابك الإعلاني', 'انسخ رقم الحساب الإعلاني (Advertiser ID) والتوكن، وحطهم هون']
    : ["Go to your TikTok Ads Manager settings", 'Find "API Access" or authorized apps', 'Generate a long-term access token for your ad account', 'Copy your Advertiser ID and the token, paste them here'];
  const guide = platform === 'meta' ? metaGuide : tiktokGuide;

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors">
        <span className="flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" />{isAr ? `ربط يدوي بتوكن (${platform === 'meta' ? 'Meta' : 'TikTok'})` : `Manual token connect (${platform === 'meta' ? 'Meta' : 'TikTok'})`}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-3 pt-1 space-y-3 border-t border-border/30 bg-muted/20">
              <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal ps-4">
                {guide.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
              <div className="space-y-2">
                <div>
                  <Label className="text-[11px]">{isAr ? 'رقم الحساب الإعلاني' : 'Ad Account ID'}</Label>
                  <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder={platform === 'meta' ? 'act_1234567890' : '1234567890'} className="h-8 text-xs" dir="ltr" />
                </div>
                <div>
                  <Label className="text-[11px]">{isAr ? 'التوكن (Access Token)' : 'Access Token'}</Label>
                  <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} type="password" placeholder="EAAxxxxxxxxxxxxx" className="h-8 text-xs" dir="ltr" />
                </div>
              </div>
              <Button size="sm" className="w-full" disabled={submitting || !accountId.trim() || !accessToken.trim()} onClick={submit}>
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : <Link2 className="w-3.5 h-3.5 me-1.5" />}
                {isAr ? 'تحقق واربط' : 'Verify & Connect'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const [weekStats, setWeekStats] = useState({ views: 0, purchases: 0, revenue: 0 });
  const [trend, setTrend] = useState<number[]>([]);
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
    const since = daysAgoISO(13);
    const rows = await adminRest.select('product_daily_stats', `store_id=eq.${currentStore.id}&stat_date=gte.${since}&select=stat_date,views,purchases,revenue`, currentStore.id);
    const arr = Array.isArray(rows) ? rows : [];
    const last7 = arr.filter((r: any) => r.stat_date >= daysAgoISO(6));
    setWeekStats({
      views: last7.reduce((s: number, r: any) => s + (r.views || 0), 0),
      purchases: last7.reduce((s: number, r: any) => s + (r.purchases || 0), 0),
      revenue: last7.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0),
    });
    const byDate: Record<string, number> = {};
    for (const r of arr) byDate[r.stat_date] = (byDate[r.stat_date] || 0) + Number(r.revenue || 0);
    const sortedDates = Object.keys(byDate).sort();
    setTrend(sortedDates.map((d) => byDate[d]));
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

  const connectOAuth = async (platform: 'meta' | 'tiktok') => {
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
        toast({ title: isAr ? 'الربط بضغطة واحدة لسا مو مفعّل' : 'One-click connect not enabled yet', description: isAr ? 'استخدم "ربط يدوي بتوكن" تحت بدلاً منه' : 'Use "Manual token connect" below instead' });
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
      {/* هوية الخبير */}
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
              {trend.length >= 2 && (
                <div className="flex items-center gap-1.5 text-white/60">
                  <span className="text-[10px]">{isAr ? 'اتجاه الإيراد 14 يوم' : '14-day revenue trend'}</span>
                  <Sparkline points={trend} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* كروت أداء الأسبوع — تملأ الصفحة بمحتوى حقيقي */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={Eye} label={isAr ? 'مشاهدات (7 أيام)' : 'Views (7d)'} value={weekStats.views} />
        <StatCard icon={ShoppingBag} label={isAr ? 'مبيعات (7 أيام)' : 'Sales (7d)'} value={weekStats.purchases} />
        <StatCard icon={DollarSign} label={isAr ? 'إيراد (7 أيام)' : 'Revenue (7d)'} value={weekStats.revenue.toLocaleString()} />
      </div>

      {/* أولويات الخبير */}
      {plan?.priorities?.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
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

      {events.length > 0 && (
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
                  {e.event_type === 'auto_action' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 rounded-full px-2 py-0.5 mt-2"><Zap className="w-3 h-3" />{isAr ? 'نفّذته بنفسي — قابل للتراجع من صفحة المنتجات' : 'I executed this — reversible from Products page'}</span>
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* شفافية: شو عم يراقب الخبير يومياً */}
      <div className="rounded-xl border border-border/40 bg-card p-5">
        <p className="text-xs font-semibold text-muted-foreground mb-3">{isAr ? 'بفحص هاي الأشياء عندك كل يوم' : "I check these for you every day"}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {WATCHLIST.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <w.icon className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-muted-foreground">{isAr ? w.ar : w.en}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ربط مصادر البيانات */}
      <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" /><p className="text-sm font-semibold">{isAr ? 'وسّع صلاحيات خبير النمو' : "Expand your growth expert's reach"}</p></div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isAr ? 'اربط حسابات إعلاناتك عشان أقدر أشخّص أداء حملاتك (نسبة النقر، الصرف، مقارنة بمعايير السوق) — مش بس أداء متجرك الداخلي.' : "Connect your ad accounts so I can diagnose campaign performance — not just your store's internal metrics."}
        </p>
        {adLoading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : adAccounts.length > 0 && (
          <div className="space-y-2">
            {adAccounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <div><p className="text-sm font-medium">{platformLabel(a.platform)}</p><p className="text-xs text-muted-foreground">{a.external_account_name}</p></div>
                </div>
                {adStatusBadge(a.status)}
              </div>
            ))}
          </div>
        )}

        {(['meta', 'tiktok'] as const).map((platform) => {
          const connected = adAccounts.some((a) => a.platform === platform && a.status === 'connected');
          if (connected) return null;
          return (
            <div key={platform} className="space-y-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={connecting === platform} onClick={() => connectOAuth(platform)}>
                  {connecting === platform ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : null}
                  {isAr ? `ربط ${platform === 'meta' ? 'Meta' : 'TikTok'} بضغطة واحدة` : `One-click connect ${platform === 'meta' ? 'Meta' : 'TikTok'}`}
                </Button>
                <a href={platform === 'meta' ? 'https://business.facebook.com' : 'https://ads.tiktok.com'} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {isAr ? 'افتح لوحة الإعلانات' : 'Open ads dashboard'}<ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ManualConnectForm isAr={isAr} platform={platform} currentStore={currentStore} onConnected={fetchAdAccounts} />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
