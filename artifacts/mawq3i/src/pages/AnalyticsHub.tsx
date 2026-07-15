import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { BarChart3, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import Analytics from './Analytics';
import Reviews from './Reviews';

export default function AnalyticsHub() {
  const { language } = useAppContext();
  const isAr = language === 'ar';
  const [tab, setTab] = useState<'analytics' | 'reviews'>('analytics');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-border/50">
        <button
          onClick={() => setTab('analytics')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'analytics' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-analytics"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {isAr ? 'الإحصائيات' : 'Analytics'}
        </button>
        <button
          onClick={() => setTab('reviews')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'reviews' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-reviews"
        >
          <MessageSquareText className="w-3.5 h-3.5" />
          {isAr ? 'التقييمات' : 'Reviews'}
        </button>
      </div>

      {tab === 'analytics' ? <Analytics /> : <Reviews />}
    </div>
  );
}
