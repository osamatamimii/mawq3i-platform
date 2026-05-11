import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Database = {
  stores: {
    id: string;
    name: string;
    slug: string;
    domain: string;
    owner_name: string;
    owner_email: string;
    owner_phone: string;
    currency: 'ILS' | 'SAR';
    status: 'active' | 'suspended';
    orders_count: number;
    total_sales: number;
    subscription_status: 'active' | 'expired' | 'trial';
    subscription_plan: 'monthly' | 'yearly';
    subscription_paid: boolean;
    renewal_date: string;
    join_date: string;
  };
  products: {
    id: string;
    store_id: string;
    name_ar: string;
    name_en: string;
    desc_ar: string;
    desc_en: string;
    price: number;
    currency: 'ILS' | 'SAR';
    stock: number;
    category: string;
    status: 'visible' | 'hidden';
  };
  orders: {
    id: string;
    store_id: string;
    customer_name: string;
    phone: string;
    city: string;
    amount: number;
    currency: 'ILS' | 'SAR';
    payment_method: string;
    status: 'new' | 'processing' | 'delivered' | 'cancelled';
    date: string;
  };
};
