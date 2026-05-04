import { useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const weeklyData = [
  { day: 'السبت', dayEn: 'Sat', sales: 1800 },
  { day: 'الأحد', dayEn: 'Sun', sales: 2400 },
  { day: 'الإثنين', dayEn: 'Mon', sales: 1600 },
  { day: 'الثلاثاء', dayEn: 'Tue', sales: 3100 },
  { day: 'الأربعاء', dayEn: 'Wed', sales: 2700 },
  { day: 'الخميس', dayEn: 'Thu', sales: 4200 },
  { day: 'الجمعة', dayEn: 'Fri', sales: 3800 },
];

const monthlyData = [
  { month: 'يناير', monthEn: 'Jan', orders: 32 },
  { month: 'فبراير', monthEn: 'Feb', orders: 45 },
  { month: 'مارس', monthEn: 'Mar', orders: 38 },
  { month: 'أبريل', monthEn: 'Apr', orders: 60 },
  { month: 'مايو', monthEn: 'May', orders: 55 },
  { month: 'يونيو', monthEn: 'Jun', orders: 72 },
  { month: 'يوليو', monthEn: 'Jul', orders: 68 },
  { month: 'أغسطس', monthEn: 'Aug', orders: 90 },
  { month: 'سبتمبر', monthEn: 'Sep', orders: 84 },
  { month: 'أكتوبر', monthEn: 'Oct', orders: 110 },
  { month: 'نوفمبر', monthEn: 'Nov', orders: 98 },
  { month: 'ديسمبر', monthEn: 'Dec', orders: 148 },
];

function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

function StatCard({ titleAr, titleEn, value, suffix = '', isAr }: {
  titleAr: string; titleEn: string; value: number; suffix?: string; isAr: boolean;
}) {
  const displayed = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className="bg-card border-border/50 hover:border-primary/20 transition-colors shadow-lg">
        <CardContent className="p-6">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
            {isAr ? titleAr : titleEn}
          </p>
          <p className="text-3xl font-bold text-foreground font-mono">
            {suffix}{displayed.toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
        <p className="text-muted-foreground mb-1">{label}</p>
        <p className="text-primary font-bold font-mono">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const { language } = useAppContext();
  const isAr = language === 'ar';

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard titleAr="مبيعات اليوم" titleEn="Today's Sales" value={3800} suffix="₪" isAr={isAr} />
        <StatCard titleAr="مبيعات الشهر" titleEn="Monthly Sales" value={24500} suffix="₪" isAr={isAr} />
        <StatCard titleAr="عدد الطلبات" titleEn="Total Orders" value={148} isAr={isAr} />
        <StatCard titleAr="متوسط الطلب" titleEn="Avg. Order" value={165} suffix="₪" isAr={isAr} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="bg-card border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {isAr ? 'المبيعات الأسبوعية' : 'Weekly Sales'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey={isAr ? 'day' : 'dayEn'}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="sales" fill="#52FF3F" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Card className="bg-card border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {isAr ? 'الطلبات الشهرية' : 'Monthly Orders'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey={isAr ? 'month' : 'monthEn'}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#52FF3F"
                    strokeWidth={2}
                    dot={{ fill: '#52FF3F', r: 3 }}
                    activeDot={{ r: 5, fill: '#52FF3F' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
