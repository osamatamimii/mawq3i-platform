import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function AdminClients() {
  const { language } = useAppContext();
  const isAr = language === 'ar';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{isAr ? 'العملاء' : 'Clients'}</h2>
        <p className="text-sm text-white/40">0 {isAr ? 'عميل مسجل' : 'registered clients'}</p>
      </div>

      <Card className="bg-white/[0.03] border-white/[0.07]">
        <CardContent className="p-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24 text-white/30 gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center">
              <Users className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-base font-medium text-white/40">{isAr ? 'لا يوجد عملاء بعد' : 'No clients yet'}</p>
            <p className="text-xs text-white/20 text-center max-w-xs">
              {isAr
                ? 'سيظهر هنا أصحاب المتاجر المسجلون بعد تفعيل نظام الدخول والمصادقة'
                : 'Store owners will appear here once authentication is enabled'}
            </p>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}
