import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, TrendingUp, Bell, LineChart, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/AppContext';
import { markOnboardingSeen } from '@/lib/onboarding';
import { requestNotificationPermissionEarly } from '@/lib/push';

type Feature = {
  icon: typeof Brain;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
};

// Real capabilities already in the platform — not generic marketing copy.
const features: Feature[] = [
  {
    icon: Brain,
    titleAr: 'خبير النمو',
    titleEn: 'Growth Expert',
    bodyAr: 'يراقب أرقام متجرك أول بأول، وبيقترحلك تحديدًا شو تسوي بعدين',
    bodyEn: 'Watches your store\'s numbers and tells you exactly what to do next',
  },
  {
    icon: TrendingUp,
    titleAr: 'بحث السوق بالذكاء الاصطناعي',
    titleEn: 'AI market research',
    bodyAr: 'يلاقيلك منتجات رايجة تناسب متجرك، ويراقب أسعار المنافسين',
    bodyEn: 'Finds trending products that fit your store, and watches competitor prices',
  },
  {
    icon: Bell,
    titleAr: 'إشعار فوري لكل طلب',
    titleEn: 'An instant alert for every order',
    bodyAr: 'توصلك رسالة لحظة ما حدا يطلب من متجرك',
    bodyEn: "You get a message the moment someone orders from your store",
  },
  {
    icon: LineChart,
    titleAr: 'كل شي من موبايلك',
    titleEn: 'Everything from your phone',
    bodyAr: 'إحصائيات، منتجات، وعروض — بمكان واحد، بأي وقت',
    bodyEn: 'Analytics, products, and promotions — in one place, anytime',
  },
];

const SLIDE_MS = 3200;

// STEP.SPLASH -> STEP.FEATURES -> STEP.NOTIFICATIONS -> onDone()
const enum Step {
  Splash = 0,
  Features = 1,
  Notifications = 2,
}

// Light, "morning" palette — a bright, welcoming first impression rather
// than the dark theme the rest of the dashboard defaults to. Colors are
// the brand greens from mawq3i-project-knowledge (#3B6D11 / #639922 /
// #97C459 / #EAF3DE) on a near-white background.
const BG = '#FCFBF8';
const CARD = '#F3F6EE';
const TEXT = '#16210A';
const MUTED = '#5C6B4D';
const PRIMARY = '#3B6D11';
const PRIMARY_SOFT = '#EAF3DE';

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { language } = useAppContext();
  const [step, setStep] = useState<Step>(Step.Splash);
  const [featureIdx, setFeatureIdx] = useState(0);
  const [enabling, setEnabling] = useState(false);
  const isAr = language === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const progressKey = useRef(0);

  useEffect(() => {
    if (step !== Step.Splash) return;
    const t = setTimeout(() => setStep(Step.Features), 1500);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step !== Step.Features) return;
    const t = setTimeout(() => {
      progressKey.current += 1;
      setFeatureIdx((i) => (i + 1) % features.length);
    }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [step, featureIdx]);

  const finish = () => {
    markOnboardingSeen();
    onDone();
  };

  const handleEnableNotifications = async () => {
    setEnabling(true);
    try {
      await requestNotificationPermissionEarly();
    } finally {
      setEnabling(false);
      finish();
    }
  };

  const feature = features[featureIdx];

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-hidden relative" style={{ background: BG }}>
      <AnimatePresence mode="wait">
        {step === Step.Splash && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 flex-1 flex flex-col items-center justify-center"
            onClick={() => setStep(Step.Features)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="relative"
            >
              <div className="absolute -inset-8 rounded-full blur-3xl" style={{ background: `${PRIMARY}22` }} />
              <img src="/logo.png" alt="Mawq3i" className="relative w-24 h-24 object-contain" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="mt-5 text-lg font-bold tracking-tight"
              style={{ color: TEXT }}
            >
              Mawq3i | موقعي
            </motion.p>
          </motion.div>
        )}

        {step === Step.Features && (
          <motion.div
            key="features"
            initial={{ opacity: 0, x: isAr ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? 24 : -24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative z-10 flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]"
          >
            <div className="flex gap-1.5 mb-8">
              {features.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { progressKey.current += 1; setFeatureIdx(i); }}
                  className="flex-1 h-[3px] rounded-full overflow-hidden"
                  style={{ background: `${PRIMARY}22` }}
                  aria-label={`feature-${i}`}
                >
                  {i === featureIdx && (
                    <motion.div
                      key={progressKey.current}
                      className="h-full rounded-full"
                      style={{ background: PRIMARY }}
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: SLIDE_MS / 1000, ease: 'linear' }}
                    />
                  )}
                  {i < featureIdx && <div className="h-full w-full rounded-full" style={{ background: PRIMARY }} />}
                </button>
              ))}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={featureIdx}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="flex flex-col items-center max-w-xs"
                >
                  <div className="relative mb-7">
                    <div
                      className="relative w-20 h-20 rounded-[26px] flex items-center justify-center"
                      style={{ background: PRIMARY_SOFT, border: `1px solid ${PRIMARY}33` }}
                    >
                      <feature.icon className="w-9 h-9" strokeWidth={1.6} style={{ color: PRIMARY }} />
                    </div>
                  </div>
                  <h1 className="text-[22px] font-bold leading-snug mb-3" style={{ color: TEXT }}>
                    {isAr ? feature.titleAr : feature.titleEn}
                  </h1>
                  <p className="text-[15px] leading-relaxed" style={{ color: MUTED }}>
                    {isAr ? feature.bodyAr : feature.bodyEn}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-6">
              <Button
                onClick={() => setStep(Step.Notifications)}
                className="w-full h-12 text-base font-semibold gap-2 text-white hover:opacity-90"
                style={{ background: PRIMARY }}
              >
                {isAr ? 'التالي' : 'Next'}
                <ArrowIcon className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === Step.Notifications && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, x: isAr ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? 24 : -24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <div className="relative mb-8">
              <div
                className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: PRIMARY_SOFT, border: `1px solid ${PRIMARY}33` }}
              >
                <Bell className="w-9 h-9" strokeWidth={1.75} style={{ color: PRIMARY }} />
              </div>
            </div>
            <h1 className="text-2xl font-bold leading-snug mb-3 max-w-xs" style={{ color: TEXT }}>
              {isAr ? 'خليك أول من يعرف بكل طلب' : 'Be first to know about every order'}
            </h1>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: MUTED }}>
              {isAr
                ? 'فعّل الإشعارات عشان توصلك رسالة فورية أول ما زبون يطلب من متجرك'
                : 'Turn on notifications to get an instant alert the moment a customer orders'}
            </p>

            <div className="w-full max-w-xs mt-10 space-y-3">
              <Button
                onClick={handleEnableNotifications}
                disabled={enabling}
                className="w-full h-12 text-base font-semibold gap-2 text-white hover:opacity-90"
                style={{ background: PRIMARY }}
              >
                <Check className="w-4 h-4" />
                {isAr ? 'فعّل الإشعارات' : 'Enable notifications'}
              </Button>
              <button
                onClick={finish}
                disabled={enabling}
                className="w-full text-sm font-medium py-2 hover:opacity-70 transition-opacity"
                style={{ color: MUTED }}
              >
                {isAr ? 'لاحقًا' : 'Maybe later'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
