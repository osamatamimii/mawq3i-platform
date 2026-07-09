import { Instagram, Mail } from 'lucide-react';

const WHATSAPP_NUMBER = '970569230200'; // +970 56 923 0200
const SUPPORT_EMAIL = 'support@mawq3i.co';
const INSTAGRAM_HANDLE = 'mawq3i.co';

function WhatsAppIcon({ className }: { className?: string }) {
  // lucide-react has no official WhatsApp glyph — inline brand-accurate SVG instead.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.001 2C6.478 2 2 6.478 2 12c0 1.888.526 3.664 1.436 5.174L2 22l4.947-1.412A9.955 9.955 0 0 0 12 22c5.523 0 10-4.478 10-10S17.523 2 12.001 2Zm0 18.2a8.17 8.17 0 0 1-4.418-1.29l-.317-.19-3.03.865.847-2.955-.207-.31A8.148 8.148 0 0 1 3.8 12c0-4.522 3.679-8.2 8.201-8.2 4.521 0 8.2 3.678 8.2 8.2 0 4.522-3.679 8.2-8.2 8.2Z" />
    </svg>
  );
}

interface SupportContactProps {
  isAr: boolean;
  variant?: 'row' | 'stacked'; // row = icons inline; stacked = icon + link, one per line
  className?: string;
}

/**
 * Company support contact links: WhatsApp, email, Instagram.
 * Used on the public Login page and inside the merchant dashboard sidebar.
 */
export default function SupportContact({ isAr, variant = 'row', className = '' }: SupportContactProps) {
  const items = [
    {
      key: 'whatsapp',
      href: `https://wa.me/${WHATSAPP_NUMBER}`,
      label: isAr ? 'واتساب الدعم' : 'WhatsApp Support',
      Icon: WhatsAppIcon,
    },
    {
      key: 'email',
      href: `mailto:${SUPPORT_EMAIL}`,
      label: SUPPORT_EMAIL,
      Icon: Mail,
    },
    {
      key: 'instagram',
      href: `https://instagram.com/${INSTAGRAM_HANDLE}`,
      label: `@${INSTAGRAM_HANDLE}`,
      Icon: Instagram,
    },
  ];

  if (variant === 'stacked') {
    return (
      <div className={`space-y-1.5 ${className}`}>
        {items.map(({ key, href, label, Icon }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            dir="ltr"
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{label}</span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {items.map(({ key, href, label, Icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
        >
          <Icon className="w-4 h-4" />
        </a>
      ))}
    </div>
  );
}
