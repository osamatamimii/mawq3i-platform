export type ProductVariant = {
  id: string;
  label: string;
  imageUrl?: string;
  stock?: number;
};

export type Product = {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  price: number;
  currency: 'ILS' | 'SAR';
  stock: number;
  category: string;
  status: 'visible' | 'hidden';
  imageUrl?: string;
  badge?: string;
  variants?: ProductVariant[];
  storeId?: string;
};

export type OrderStatus = 'new' | 'processing' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  customerName: string;
  phone: string;
  city: string;
  address?: string;
  amount: number;
  currency: 'ILS' | 'SAR';
  paymentMethod: string;
  productName?: string;
  items?: { productId: string; productName: string; variantLabel?: string; quantity: number; price: number }[];
  notes?: string;
  status: OrderStatus;
  date: string;
};

export type StoreRecord = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  currency: 'ILS' | 'SAR';
  status: 'active' | 'suspended';
  ordersCount: number;
  totalSales: number;
  subscriptionStatus: 'active' | 'expired' | 'trial';
  subscriptionPlan: 'monthly' | 'yearly';
  subscriptionPaid: boolean;
  renewalDate: string;
  joinDate: string;
  primaryColor?: string;
  logoUrl?: string;
  description?: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  storeId: string;
  storeName: string;
  joinDate: string;
  status: 'active' | 'suspended';
  country: string;
};

export type Subscription = {
  id: string;
  storeId: string;
  storeName: string;
  ownerName: string;
  plan: 'monthly' | 'yearly';
  status: 'active' | 'expired' | 'trial';
  startDate: string;
  renewalDate: string;
  amount: number;
  currency: 'ILS' | 'SAR';
  paid: boolean;
};

export const initialProducts: Product[] = [
  { id: '1', nameAr: 'عطر الفاخر', nameEn: 'Luxury Perfume', descAr: 'عطر مميز', descEn: 'Distinctive perfume', price: 250, currency: 'SAR', stock: 15, category: 'عطور', status: 'visible' },
  { id: '2', nameAr: 'كوفية تراثية', nameEn: 'Traditional Keffiyeh', descAr: 'كوفية أصلية', descEn: 'Original keffiyeh', price: 80, currency: 'ILS', stock: 50, category: 'ملابس', status: 'visible' },
  { id: '3', nameAr: 'مسبحة الكريستال', nameEn: 'Crystal Rosary', descAr: 'مسبحة جميلة', descEn: 'Beautiful rosary', price: 120, currency: 'SAR', stock: 3, category: 'إكسسوارات', status: 'visible' },
  { id: '4', nameAr: 'قهوة عربية ممتازة', nameEn: 'Premium Arabic Coffee', descAr: 'قهوة أصيلة', descEn: 'Authentic coffee', price: 60, currency: 'SAR', stock: 100, category: 'مشروبات', status: 'visible' },
  { id: '5', nameAr: 'تمر المدينة', nameEn: 'Madina Dates', descAr: 'تمر عالي الجودة', descEn: 'High quality dates', price: 90, currency: 'SAR', stock: 2, category: 'طعام', status: 'visible' },
  { id: '6', nameAr: 'زيت عود', nameEn: 'Oud Oil', descAr: 'زيت عود أصلي', descEn: 'Original Oud oil', price: 400, currency: 'SAR', stock: 10, category: 'عطور', status: 'hidden' },
  { id: '7', nameAr: 'بخور فاخر', nameEn: 'Luxury Incense', descAr: 'بخور للمناسبات', descEn: 'Incense for occasions', price: 150, currency: 'SAR', stock: 25, category: 'عطور', status: 'visible' },
  { id: '8', nameAr: 'خاتم ذهبي', nameEn: 'Golden Ring', descAr: 'خاتم أنيق', descEn: 'Elegant ring', price: 300, currency: 'ILS', stock: 5, category: 'إكسسوارات', status: 'visible' },
];

export const initialOrders: Order[] = [
  { id: 'ORD-1001', customerName: 'أحمد صالح', phone: '0591234567', city: 'رام الله', amount: 350, currency: 'ILS', paymentMethod: 'عند الاستلام', status: 'new', date: '2026-05-01' },
  { id: 'ORD-1002', customerName: 'سارة خالد', phone: '0569876543', city: 'نابلس', amount: 120, currency: 'ILS', paymentMethod: 'بطاقة ائتمان', status: 'processing', date: '2026-04-30' },
  { id: 'ORD-1003', customerName: 'محمد عبد الله', phone: '0501112223', city: 'الرياض', amount: 450, currency: 'SAR', paymentMethod: 'مدى', status: 'delivered', date: '2026-04-29' },
  { id: 'ORD-1004', customerName: 'فاطمة علي', phone: '0554445556', city: 'جدة', amount: 800, currency: 'SAR', paymentMethod: 'تحويل بنكي', status: 'cancelled', date: '2026-04-28' },
  { id: 'ORD-1005', customerName: 'محمود حسن', phone: '0598887776', city: 'القدس', amount: 200, currency: 'ILS', paymentMethod: 'عند الاستلام', status: 'delivered', date: '2026-04-27' },
  { id: 'ORD-1006', customerName: 'يوسف جمال', phone: '0595556667', city: 'جنين', amount: 150, currency: 'ILS', paymentMethod: 'عند الاستلام', status: 'processing', date: '2026-04-26' },
  { id: 'ORD-1007', customerName: 'نورة سعد', phone: '0509998887', city: 'الرياض', amount: 600, currency: 'SAR', paymentMethod: 'بطاقة ائتمان', status: 'new', date: '2026-04-25' },
  { id: 'ORD-1008', customerName: 'عمر طارق', phone: '0563334445', city: 'رام الله', amount: 90, currency: 'ILS', paymentMethod: 'عند الاستلام', status: 'delivered', date: '2026-04-24' },
];

export const adminStores: StoreRecord[] = [
  {
    id: '1', name: 'متجر الأناقة', slug: 'elegance',
    domain: 'elegance.mawq3i.com', ownerName: 'أحمد السيد', ownerEmail: 'ahmed@elegance.com', ownerPhone: '+970591234567',
    currency: 'ILS', status: 'active', ordersCount: 1250, totalSales: 186500,
    subscriptionStatus: 'active', subscriptionPlan: 'yearly', subscriptionPaid: true, renewalDate: '2027-01-15', joinDate: '2025-01-15',
  },
  {
    id: '2', name: 'تراثيات', slug: 'turath',
    domain: 'heritage.mawq3i.com', ownerName: 'منى الخالد', ownerEmail: 'mona@turath.ps', ownerPhone: '+970598765432',
    currency: 'ILS', status: 'active', ordersCount: 840, totalSales: 67200,
    subscriptionStatus: 'active', subscriptionPlan: 'monthly', subscriptionPaid: true, renewalDate: '2026-06-01', joinDate: '2025-03-10',
  },
  {
    id: '3', name: 'عطور الشرق', slug: 'oudeast',
    domain: 'oud.mawq3i.com', ownerName: 'خالد المنصور', ownerEmail: 'khaled@oud.sa', ownerPhone: '+966501112223',
    currency: 'SAR', status: 'active', ordersCount: 432, totalSales: 194400,
    subscriptionStatus: 'trial', subscriptionPlan: 'yearly', subscriptionPaid: false, renewalDate: '2026-05-20', joinDate: '2026-04-20',
  },
  {
    id: '4', name: 'مكتبة اقرأ', slug: 'iqra',
    domain: 'read.mawq3i.com', ownerName: 'سلمى حسن', ownerEmail: 'salma@iqra.ps', ownerPhone: '+970592223334',
    currency: 'ILS', status: 'suspended', ordersCount: 95, totalSales: 9500,
    subscriptionStatus: 'expired', subscriptionPlan: 'monthly', subscriptionPaid: false, renewalDate: '2026-03-01', joinDate: '2025-06-20',
  },
  {
    id: '5', name: 'إلكترونيات بلس', slug: 'electro',
    domain: 'electro.mawq3i.com', ownerName: 'فهد العتيبي', ownerEmail: 'fahad@electro.sa', ownerPhone: '+966551234567',
    currency: 'SAR', status: 'active', ordersCount: 3100, totalSales: 1550000,
    subscriptionStatus: 'active', subscriptionPlan: 'yearly', subscriptionPaid: true, renewalDate: '2026-12-01', joinDate: '2024-12-01',
  },
  {
    id: '6', name: 'عسل الجبل', slug: 'honey',
    domain: 'honey.mawq3i.com', ownerName: 'يحيى المطيري', ownerEmail: 'yahya@honey.sa', ownerPhone: '+966559876543',
    currency: 'SAR', status: 'active', ordersCount: 215, totalSales: 32250,
    subscriptionStatus: 'active', subscriptionPlan: 'monthly', subscriptionPaid: true, renewalDate: '2026-06-10', joinDate: '2025-11-10',
  },
];

export const adminClients: Client[] = adminStores.map(s => ({
  id: s.id,
  name: s.ownerName,
  email: s.ownerEmail,
  phone: s.ownerPhone,
  storeId: s.id,
  storeName: s.name,
  joinDate: s.joinDate,
  status: s.status,
  country: s.currency === 'ILS' ? 'فلسطين' : 'السعودية',
}));

export const adminSubscriptions: Subscription[] = adminStores.map(s => ({
  id: `SUB-${s.id}`,
  storeId: s.id,
  storeName: s.name,
  ownerName: s.ownerName,
  plan: s.subscriptionPlan,
  status: s.subscriptionStatus,
  startDate: s.joinDate,
  renewalDate: s.renewalDate,
  amount: s.subscriptionPlan === 'yearly' ? (s.currency === 'ILS' ? 588 : 588) : (s.currency === 'ILS' ? 59 : 59),
  currency: s.currency,
  paid: s.subscriptionPaid,
}));
