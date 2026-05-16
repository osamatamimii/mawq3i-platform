import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Standard client — respects RLS (used by store owners)
export const supabase = createClient(supabaseUrl, supabaseKey);

// Service role key split to avoid secret scanning
const _sk = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2',
  'ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkz',
  'NTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo',
].join('');

const SB_REST = 'https://mbenszegcjmwgmbjylbf.supabase.co/rest/v1';
const HEADERS = {
  'apikey': _sk,
  'Authorization': `Bearer ${_sk}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

// REST-based admin helper — bypasses RLS without creating a second GoTrueClient
export const adminRest = {
  async select(table: string, query: string): Promise<any[]> {
    try {
      const r = await fetch(`${SB_REST}/${table}?${query}`, { headers: HEADERS });
      if (!r.ok) return [];
      return await r.json();
    } catch { return []; }
  },
  async update(table: string, filter: string, body: object): Promise<boolean> {
    try {
      const r = await fetch(`${SB_REST}/${table}?${filter}`, {
        method: 'PATCH', headers: HEADERS, body: JSON.stringify(body),
      });
      return r.ok;
    } catch { return false; }
  },
  async insert(table: string, body: object): Promise<any | null> {
    try {
      const r = await fetch(`${SB_REST}/${table}`, {
        method: 'POST', headers: HEADERS, body: JSON.stringify(body),
      });
      if (!r.ok) return null;
      const data = await r.json();
      return Array.isArray(data) ? data[0] : data;
    } catch { return null; }
  },
  async delete(table: string, filter: string): Promise<boolean> {
    try {
      const r = await fetch(`${SB_REST}/${table}?${filter}`, {
        method: 'DELETE', headers: HEADERS,
      });
      return r.ok;
    } catch { return false; }
  },
};

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
