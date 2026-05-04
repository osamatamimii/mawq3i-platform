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
};

export type OrderStatus = 'new' | 'processing' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  customerName: string;
  phone: string;
  city: string;
  amount: number;
  currency: 'ILS' | 'SAR';
  paymentMethod: string;
  status: OrderStatus;
  date: string;
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
  { id: 'ORD-1001', customerName: 'أحمد صالح', phone: '0591234567', city: 'رام الله', amount: 350, currency: 'ILS', paymentMethod: 'عند الاستلام', status: 'new', date: '2023-10-25' },
  { id: 'ORD-1002', customerName: 'سارة خالد', phone: '0569876543', city: 'نابلس', amount: 120, currency: 'ILS', paymentMethod: 'بطاقة ائتمان', status: 'processing', date: '2023-10-24' },
  { id: 'ORD-1003', customerName: 'محمد عبد الله', phone: '0501112223', city: 'الرياض', amount: 450, currency: 'SAR', paymentMethod: 'مدى', status: 'delivered', date: '2023-10-23' },
  { id: 'ORD-1004', customerName: 'فاطمة علي', phone: '0554445556', city: 'جدة', amount: 800, currency: 'SAR', paymentMethod: 'تحويل بنكي', status: 'cancelled', date: '2023-10-22' },
  { id: 'ORD-1005', customerName: 'محمود حسن', phone: '0598887776', city: 'القدس', amount: 200, currency: 'ILS', paymentMethod: 'عند الاستلام', status: 'delivered', date: '2023-10-21' },
  { id: 'ORD-1006', customerName: 'يوسف جمال', phone: '0595556667', city: 'جنين', amount: 150, currency: 'ILS', paymentMethod: 'عند الاستلام', status: 'processing', date: '2023-10-20' },
  { id: 'ORD-1007', customerName: 'نورة سعد', phone: '0509998887', city: 'الرياض', amount: 600, currency: 'SAR', paymentMethod: 'بطاقة ائتمان', status: 'new', date: '2023-10-19' },
  { id: 'ORD-1008', customerName: 'عمر طارق', phone: '0563334445', city: 'رام الله', amount: 90, currency: 'ILS', paymentMethod: 'عند الاستلام', status: 'delivered', date: '2023-10-18' },
];

export const mockStores = [
  { id: '1', name: 'متجر الأناقة', domain: 'elegance.mawq3i.com', orders: 1250, currency: 'SAR', status: 'نشط' },
  { id: '2', name: 'تراثيات', domain: 'heritage.mawq3i.com', orders: 840, currency: 'ILS', status: 'نشط' },
  { id: '3', name: 'عطور الشرق', domain: 'oud.mawq3i.com', orders: 432, currency: 'SAR', status: 'نشط' },
  { id: '4', name: 'مكتبة اقرأ', domain: 'read.mawq3i.com', orders: 95, currency: 'ILS', status: 'متوقف' },
  { id: '5', name: 'إلكترونيات بلس', domain: 'electro.mawq3i.com', orders: 3100, currency: 'SAR', status: 'نشط' },
];
