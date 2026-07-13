import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { adminRest } from '@/lib/supabase';
import { getAllStores } from '@/lib/db';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, ImageIcon, LayoutGrid } from 'lucide-react';

const TOOL_LABELS: Record<string, { ar: string; en: string }> = {
  ai_advisor: { ar: 'المستشار الذكي (محادثة)', en: 'AI Advisor (chat)' },
  ai_agent: { ar: 'الوكيل الذكي (7 أدوات)', en: 'AI Agent (7 tools)' },
  'text:product_name': { ar: 'تحسين اسم منتج', en: 'Enhance product name' },
  'text:product_description': { ar: 'تحسين وصف منتج', en: 'Enhance product description' },
  'text:promo_title': { ar: 'تحسين عنوان بانر', en: 'Enhance promo title' },
  'text:promo_subtitle': { ar: 'تحسين وصف بانر', en: 'Enhance promo subtitle' },
  'text:store_description': { ar: 'تحسين وصف المتجر', en: 'Enhance store description' },
  'text:social_post': { ar: 'كابشن سوشال ميديا', en: 'Social media caption' },
  'text:whatsapp_broadcast': { ar: 'رسالة واتساب تسويقية', en: 'WhatsApp marketing message' },
  image_enhance: { ar: 'تحسين صورة منتج', en: 'Product photo enhancement' },
};

const SECTION_LABELS: Record<string, { ar: string; en: string }> = {
  '/dashboard': { ar: 'لوحة التحكم', en: 'Dashboard' },
  '/dashboard/products': { ar: 'المنتجات', en: 'Products' },
  '/dashboard/add-product': { ar: 'إضافة منتج', en: 'Add product' },
  '/dashboard/orders': { ar: 'الطلبات', en: 'Orders' },
  '/dashboard/analytics': { ar: 'الإحصائيات', en: 'Analytics' },
  '/dashboard/settings': { ar: 'إعدادات المتجر', en: 'Store settings' },
  '/dashboard/staff': { ar: 'الموظفون', en: 'Staff' },
  '/dashboard/marketing-studio': { ar: 'استوديو التسويق', en: 'Marketing Studio' },
  '/dashboard/promotions': { ar: 'العروض', en: 'Promotions' },
  '/dashboard/discount-codes': { ar: 'أكواد الخصم', en: 'Discount codes' },
  '/dashboard/ai-advisor': { ar: 'المستشار الذكي', en: 'AI Advisor' },
  '/dashboard/reviews': { ar: 'التقييمات', en: 'Reviews' },
  '/dashboard/abandoned-carts': { ar: 'سلات متروكة', en: 'Abandoned carts' },
};

function startOfMonthISO() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}
function daysAgoISO(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

type StoreUsage = { storeId: string; storeName: string; images: number; aiTools: number };
type KeyCount = { key: string; count: number };

export default function AIUsage() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [loading, setLoading] = useState(true);
  const [storeUsage, setStoreUsage] = useState<StoreUsage[]>([]);
  const [toolBreakdown, setToolBreakdown] = useState<KeyCount[]>([]);
  const [sectionBreakdown, setSectionBreakdown] = useState<KeyCount[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const monthStart = startOfMonthISO();
      const last30 = daysAgoISO(30);

      const [stores, imageRows, toolRowsMonth, toolRows30d, pageRows30d] = await Promise.all([
        getAllStores(),
        adminRest.select('ai_image_generations', `created_at=gte.${monthStart}&select=store_id`),
        adminRest.select('feature_usage_events', `event_type=eq.ai_tool&created_at=gte.${monthStart}&select=store_id`),
        adminRest.select('feature_usage_events', `event_type=eq.ai_tool&created_at=gte.${last30}&select=feature_key`),
        adminRest.select('feature_usage_events', `event_type=eq.page_view&created_at=gte.${last30}&select=feature_key`),
      ]);

      // Per-store usage this month
      const imageCounts: Record<string, number> = {};
      for (const r of imageRows) imageCounts[r.store_id] = (imageCounts[r.store_id] || 0) + 1;
      const toolCounts: Record<string, number> = {};
      for (const r of toolRowsMonth) toolCounts[r.store_id] = (toolCounts[r.store_id] || 0) + 1;

      const usage: StoreUsage[] = stores
        .map((s) => ({
          storeId: s.id,
          storeName: s.name,
          images: imageCounts[s.id] || 0,
          aiTools: toolCounts[s.id] || 0,
        }))
        .filter((s) => s.images > 0 || s.aiTools > 0)
        .sort((a, b) => (b.images + b.aiTools) - (a.images + a.aiTools));
      setStoreUsage(usage);

      // Tool breakdown (last 30 days, all stores) — include image enhancement as its own row
      const toolKeyCounts: Record<string, number> = {};
      for (const r of toolRows30d) toolKeyCounts[r.feature_key] = (toolKeyCounts[r.feature_key] || 0) + 1;
      const imageRows30d = await adminRest.select('ai_image_generations', `created_at=gte.${last30}&select=id`);
      if (imageRows30d.length) toolKeyCounts['image_enhance'] = imageRows30d.length;
      setToolBreakdown(Object.entries(toolKeyCounts).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count));

      // Section breakdown (last 30 days, all stores)
      const sectionKeyCounts: Record<string, number> = {};
      for (const r of pageRows30d) sectionKeyCounts[r.feature_key] = (sectionKeyCounts[r.feature_key] || 0) + 1;
      setSectionBreakdown(Object.entries(sectionKeyCounts).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count));

      setLoading(false);
    })();
  }, []);

  const maxToolCount = Math.max(1, ...toolBreakdown.map((t) => t.count));
  const maxSectionCount = Math.max(1, ...sectionBreakdown.map((s) => s.count));

  const allKnownSections = Object.keys(SECTION_LABELS);
  const unusedSections = allKnownSections.filter((s) => !sectionBreakdown.some((b) => b.key === s));
  const allKnownTools = Object.keys(TOOL_LABELS);
  const unusedTools = allKnownTools.filter((t) => !toolBreakdown.some((b) => b.key === t));

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          {isAr ? 'استخدام الذكاء الاصطناعي وميزات المنصة' : 'AI & Platform Feature Usage'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr ? 'مين بيستخدم شو، عشان نعرف وين نركّز ووين نلغي' : 'What gets used and by whom, to guide what to keep or cut'}
        </p>
      </div>

      {/* Per-store AI usage this month */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {isAr ? 'استخدام الذكاء الاصطناعي لكل متجر (هذا الشهر)' : 'AI usage per store (this month)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {storeUsage.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{isAr ? 'ما في استخدام مسجّل هذا الشهر بعد' : 'No usage logged yet this month'}</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-xs text-muted-foreground font-medium px-1">
                <span>{isAr ? 'المتجر' : 'Store'}</span>
                <span className="w-16 text-center">{isAr ? 'صور' : 'Images'}</span>
                <span className="w-20 text-center">{isAr ? 'أدوات نص/محادثة' : 'Text/chat tools'}</span>
              </div>
              {storeUsage.map((s) => (
                <div key={s.storeId} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center p-2.5 rounded-lg border border-border/40 bg-background/50">
                  <span className="text-sm font-medium truncate">{s.storeName}</span>
                  <span className="w-16 text-center text-sm font-mono">{s.images}<span className="text-muted-foreground">/150</span></span>
                  <span className="w-20 text-center text-sm font-mono">{s.aiTools}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI tool breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            {isAr ? 'استخدام كل أداة ذكاء اصطناعي (آخر 30 يوم)' : 'AI tool usage (last 30 days)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {toolBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{isAr ? 'ما في استخدام مسجّل' : 'No usage logged'}</p>
          ) : (
            toolBreakdown.map((t) => (
              <div key={t.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{TOOL_LABELS[t.key]?.[isAr ? 'ar' : 'en'] || t.key}</span>
                  <span className="font-mono text-muted-foreground">{t.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(t.count / maxToolCount) * 100}%` }} />
                </div>
              </div>
            ))
          )}
          {unusedTools.length > 0 && (
            <div className="pt-3 mt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground font-medium mb-1.5">{isAr ? 'ما استُخدمت أبداً آخر 30 يوم:' : 'Never used in last 30 days:'}</p>
              <div className="flex flex-wrap gap-1.5">
                {unusedTools.map((t) => (
                  <span key={t} className="text-[11px] bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5">{TOOL_LABELS[t]?.[isAr ? 'ar' : 'en'] || t}</span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section/page breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-primary" />
            {isAr ? 'استخدام أقسام المنصة (آخر 30 يوم)' : 'Platform section usage (last 30 days)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {sectionBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{isAr ? 'ما في استخدام مسجّل بعد — التتبع بلش اليوم' : 'No usage logged yet — tracking just started today'}</p>
          ) : (
            sectionBreakdown.map((s) => (
              <div key={s.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{SECTION_LABELS[s.key]?.[isAr ? 'ar' : 'en'] || s.key}</span>
                  <span className="font-mono text-muted-foreground">{s.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(s.count / maxSectionCount) * 100}%` }} />
                </div>
              </div>
            ))
          )}
          {unusedSections.length > 0 && (
            <div className="pt-3 mt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground font-medium mb-1.5">{isAr ? 'ما زارها حد آخر 30 يوم:' : 'Not visited in last 30 days:'}</p>
              <div className="flex flex-wrap gap-1.5">
                {unusedSections.map((s) => (
                  <span key={s} className="text-[11px] bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5">{SECTION_LABELS[s]?.[isAr ? 'ar' : 'en'] || s}</span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground/70 pt-2">
            {isAr ? 'ملاحظة: التتبع بلش اليوم، فالأرقام رح تصير أدق مع مرور الوقت.' : 'Note: tracking just started today, numbers will get more meaningful over time.'}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
