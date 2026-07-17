// ============================================================
// Growth Agent — Cron موحّد (endpoint واحد بدل 5)
// خطة Vercel "Hobby" فيها حد أقصى قليل لعدد الـ Cron jobs — هاد الملف
// يجمع كل مهام وكيل النمو اليومية/الأسبوعية/الشهرية بـ Cron واحد بس،
// ويشغّل كل مهمة حسب يوم الأسبوع/الشهر.
//
// مجدول: يومياً 3 صباحاً UTC (انظر vercel.json)
// يدوياً: GET/POST /api/growth-agent-cron
// ============================================================

import { runSync } from './growth-agent-sync.js';
import { runAdsSync } from './growth-agent-ads-sync.js';
import { runDiagnose } from './growth-agent-diagnose.js';
import { runCaptureResults } from './growth-agent-capture-results.js';
import { runMonthlyPlan } from './growth-agent-monthly-plan.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const now = new Date();
  const isSunday = now.getUTCDay() === 0;   // قياس نتائج الإجراءات — أسبوعي
  const isFirstOfMonth = now.getUTCDate() === 1; // التقييم الشهري لمرحلة النمو

  const results = {};

  // كل يوم: مزامنة البيانات (متاجر + إعلانات) ثم التشخيص — بالترتيب، لأن التشخيص يعتمد على بيانات المزامنة
  try { results.sync = await runSync(); } catch (e) { results.sync = { error: e?.message }; }
  try { results.adsSync = await runAdsSync(); } catch (e) { results.adsSync = { error: e?.message }; }
  try { results.diagnose = await runDiagnose(); } catch (e) { results.diagnose = { error: e?.message }; }

  // أسبوعي (الأحد): قياس نتائج الإجراءات المنفذة
  if (isSunday) {
    try { results.captureResults = await runCaptureResults(); } catch (e) { results.captureResults = { error: e?.message }; }
  }

  // شهري (أول يوم بالشهر): تقييم مرحلة النمو + خطة مخصصة
  if (isFirstOfMonth) {
    try { results.monthlyPlan = await runMonthlyPlan(); } catch (e) { results.monthlyPlan = { error: e?.message }; }
  }

  res.status(200).json({ ranAt: now.toISOString(), isSunday, isFirstOfMonth, results });
}
