import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Settings as SettingsIcon, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import Settings from './Settings';
import Staff from './Staff';

export default function SettingsHub() {
  const { language, staffPermissions } = useAppContext();
  const isAr = language === 'ar';
  const [tab, setTab] = useState<'settings' | 'staff'>('settings');
  const canSeeStaffTab = !staffPermissions; // only the store owner (not a limited staff account) manages staff

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-border/50">
        <button
          onClick={() => setTab('settings')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'settings' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          data-testid="tab-settings"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          {isAr ? 'إعدادات المتجر' : 'Store Settings'}
        </button>
        {canSeeStaffTab && (
          <button
            onClick={() => setTab('staff')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === 'staff' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
            data-testid="tab-staff"
          >
            <Users className="w-3.5 h-3.5" />
            {isAr ? 'الموظفون' : 'Staff'}
          </button>
        )}
      </div>

      {tab === 'staff' && canSeeStaffTab ? <Staff /> : <Settings />}
    </div>
  );
}
