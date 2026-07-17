import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { adminRest } from '@/lib/supabase';
import { getAllStores } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Database, Gauge } from 'lucide-react';

type DailyStatRow = {
  id: string;
  product_id: string;
  stat_date: string;
  views: number;
  add_to_cart: number;
  purchases: number;
  revenue: number;
};

type GrowthEvent = {
  id: string;
  category: string;
  title: string;
  description: string;
  related_product_id: string | null;
  created_at: string;
};

type Benchmark = {
  category: string;
  segment: string;
  metric_key: string;
  metric_min: number;
  metric_max: number;
  metric_avg: number;
  unit: string;
  source: string;
};

function daysAgoISO(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function GrowthAgent() {
  const { language } = useAppContext();
  const isAr = language === 'ar';

  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [statsLoading, setStatsLoading] = useState(false);
  const [dailyStats, setDailyStats] = useState<DailyStatRow[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [growthEvents, setGrowthEvents] = useState<GrowthEvent[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);

  // تحميل قائمة المتاجر + معايير السوق (مرة وحدة)
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [allStores, benchmarkRows] = await Promise.all([
        getAllStores(),
        adminRest.select('market_benchmarks', 'select=category,segment,metric_key,metric_min,metric_max,metric_avg,unit,source&order=category.asc'),
      ]);
      setStores(allStores.map((s: any) => ({ id: s.id, name: s.name })));
      setBenchmarks(benchmarkRows as Benchmark[]);
      if (allStores.length) setSelectedStoreId(allStores[0].id);
      setLoading(false);
    })();
  }, []);

  // تحميل بيانات أداء المنتجات اليومية لآخر 14 يوم، لما يتغيّر المتجر المختار
  useEffect(() => {
    if (!selectedStoreId) return;
    (async () => {
      setStatsLoading(true);
      const since = daysAgoISO(14);
      const [statsRows, products, eventsRows] = await Promise.all([
        adminRest.select(
          'product_daily_stats',
          `store_id=eq.${selectedStoreId}&stat_date=gte.${since}&select=id,product_id,stat_date,views,add_to_cart,purchases,revenue&order=stat_date.desc`
        ),
        adminRest.select('products', `store_id=eq.${selectedStoreId}&select=id,name_ar,name_en`),
        adminRest.select(
          'store_growth_events',
          `store_id=eq.${selectedStoreId}&order=created_at.desc&limit=30&select=id,category,title,description,related_product_id,created_at`
        ),
      ]);
      const nameMap: Record<string, string> = {};
      for (const p of products) nameMap[p.id] = p.name_ar || p.name_en || p.id;
      setProductNames(nameMap);
      setDailyStats(statsRows as DailyStatRow[]);
      setGrowthEvents(eventsRows as GrowthEvent[]);
      setStatsLoading(false);
    })();
  }, [selectedStoreId]);

  const totalViews = dailyStats.reduce((sum, r) => sum + (r.views || 0), 0);
  const totalPurchases = dailyStats.reduce((sum, r) => sum + (r.purchases || 0), 0);
  const totalRevenue = dailyStats.reduce((sum, r) => sum + (r.revenue || 0), 0);

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          {isAr ? 'وكيل النمو — البيانات الخام' : 'Growth Agent — Raw Data'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? 'المرحلة 0: تحقق من البيانات الخام قبل بناء أي منطق تشخيص فوقها.'
            : 'Phase 0: verify raw data before building any diagnosis logic on top of it.'}
        </p>
      </div>

      {/* اختيار المتجر */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{isAr ? 'اختر متجر' : 'Select store'}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="w-full sm:w-72 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* أداء المنتجات اليومي — آخر 14 يوم */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            {isAr ? 'أداء المنتجات (آخر 14 يوم)' : 'Product performance (last 14 days)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {statsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : dailyStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {isAr
                ? 'ما في بيانات بعد لهاد المتجر. المزامنة اليومية (api/growth-agent-sync) لسا ما اشتغلت أو ما لقت مبيعات/مشاهدات بالفترة هاي.'
                : 'No data yet for this store. The daily sync (api/growth-agent-sync) hasn\'t run yet or found no views/sales in this window.'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg border border-border/40 bg-background/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">{isAr ? 'إجمالي المشاهدات' : 'Total views'}</p>
                  <p className="text-lg font-bold font-mono">{totalViews}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">{isAr ? 'إجمالي المبيعات' : 'Total purchases'}</p>
                  <p className="text-lg font-bold font-mono">{totalPurchases}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">{isAr ? 'إجمالي الإيراد' : 'Total revenue'}</p>
                  <p className="text-lg font-bold font-mono">{totalRevenue.toLocaleString()}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border/40">
                      <th className="text-start py-2 px-2">{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className="text-start py-2 px-2">{isAr ? 'المنتج' : 'Product'}</th>
                      <th className="text-center py-2 px-2">{isAr ? 'مشاهدات' : 'Views'}</th>
                      <th className="text-center py-2 px-2">{isAr ? 'مبيعات' : 'Purchases'}</th>
                      <th className="text-center py-2 px-2">{isAr ? 'إيراد' : 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyStats.map((r) => (
                      <tr key={r.id} className="border-b border-border/20">
                        <td className="py-2 px-2 font-mono text-xs">{r.stat_date}</td>
                        <td className="py-2 px-2 truncate max-w-[220px]">{productNames[r.product_id] || r.product_id}</td>
                        <td className="py-2 px-2 text-center font-mono">{r.views}</td>
                        <td className="py-2 px-2 text-center font-mono">{r.purchases}</td>
                        <td className="py-2 px-2 text-center font-mono">{r.revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* التشخيصات (المرحلة 1) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {isAr ? 'تشخيصات وكيل النمو (آخر 30)' : 'Growth agent diagnoses (last 30)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {statsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : growthEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {isAr
                ? 'ما في تشخيصات بعد لهاد المتجر. محرك التشخيص (api/growth-agent-diagnose) لسا ما اشتغل، أو المتجر ما عنده مشاكل واضحة حسب القواعد الحالية.'
                : 'No diagnoses yet for this store. The diagnosis engine (api/growth-agent-diagnose) hasn\'t run yet, or the store has no clear issues under the current rules.'}
            </p>
          ) : (
            <div className="space-y-2">
              {growthEvents.map((e) => (
                <div key={e.id} className="rounded-lg border border-border/40 bg-background/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{e.title}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleDateString(isAr ? 'ar' : 'en')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{e.description}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* معايير السوق (Benchmarks) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            {isAr ? 'معايير السوق العالمية 2026 (نقطة انطلاق مؤقتة)' : 'Global market benchmarks 2026 (temporary starting point)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border/40">
                  <th className="text-start py-2 px-2">{isAr ? 'الفئة' : 'Category'}</th>
                  <th className="text-start py-2 px-2">{isAr ? 'القطاع' : 'Segment'}</th>
                  <th className="text-start py-2 px-2">{isAr ? 'المقياس' : 'Metric'}</th>
                  <th className="text-center py-2 px-2">{isAr ? 'المدى' : 'Range'}</th>
                  <th className="text-center py-2 px-2">{isAr ? 'المتوسط' : 'Avg'}</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((b, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td className="py-2 px-2">{b.category}</td>
                    <td className="py-2 px-2">{b.segment}</td>
                    <td className="py-2 px-2 font-mono text-xs">{b.metric_key}</td>
                    <td className="py-2 px-2 text-center font-mono text-xs">{b.metric_min}–{b.metric_max} {b.unit}</td>
                    <td className="py-2 px-2 text-center font-mono">{b.metric_avg} {b.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground/70 pt-3">
            {isAr
              ? 'هاي أرقام عامة من السوق العالمي، مش من متاجر Mawq3i. تُستبدل تدريجياً بأرقام حقيقية بعد ما يتراكم عدد كافي من المتاجر (المرحلة 4 بخارطة الطريق).'
              : 'These are general global-market figures, not from Mawq3i stores. They will be gradually replaced by real data once enough stores accumulate (Phase 4 of the roadmap).'}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
