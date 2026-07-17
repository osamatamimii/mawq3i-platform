import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import {
  Loader2, Link2, ShieldCheck, ExternalLink, ChevronDown, KeyRound, ArrowRight,
  Package, Store as StoreIcon, ShoppingCart, Megaphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface AdAccount {
  id: string;
  platform: 'meta' | 'tiktok';
  external_account_name: string;
  status: string;
}

const WATCHLIST = [
  { icon: Package, ar: 'منتجات راكدة بدون مبيعات', en: 'Stagnant products with no sales' },
  { icon: StoreIcon, ar: 'معدل تحويل متجرك مقابل معايير السوق', en: "Your store's conversion vs. market benchmarks" },
  { icon: ShoppingCart, ar: 'نسبة التخلي عن السلة', en: 'Cart abandonment rate' },
  { icon: Megaphone, ar: 'أداء إعلاناتك (لو مربوطة)', en: 'Your ad performance (if connected)' },
];

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

export default function GrowthConnections() {
  const { language, currentStore } = useAppContext();
  const { toast } = useToast();
  const isAr = language === 'ar';

  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [adLoading, setAdLoading] = useState(true);
  const [connecting, setConnecting] = useState<'meta' | 'tiktok' | null>(null);

  const fetchAdAccounts = async () => {
    if (!currentStore?.id) return;
    const { data } = await supabase.from('ad_accounts').select('id, platform, external_account_name, status').eq('store_id', currentStore.id);
    setAdAccounts(data || []);
    setAdLoading(false);
  };

  useEffect(() => { fetchAdAccounts(); }, [currentStore?.id]);

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

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <Link href="/dashboard/growth" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
        <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />{isAr ? 'رجوع لخبير النمو' : 'Back to Growth Expert'}
      </Link>

      <div>
        <h1 className="text-lg font-bold">{isAr ? 'إعدادات خبير النمو' : 'Growth Expert Settings'}</h1>
        <p className="text-sm text-muted-foreground mt-1">{isAr ? 'وسّع صلاحياته وشوف شو بيراقب بالضبط' : 'Expand his reach and see exactly what he monitors'}</p>
      </div>

      <div className="rounded-xl border border-border/40 bg-card p-5">
        <p className="text-xs font-semibold text-muted-foreground mb-3">{isAr ? 'بفحص هاي الأشياء عندك كل يوم' : 'I check these for you every day'}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {WATCHLIST.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <w.icon className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-muted-foreground">{isAr ? w.ar : w.en}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" /><p className="text-sm font-semibold">{isAr ? 'ربط حسابات الإعلانات' : 'Connect ad accounts'}</p></div>
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
