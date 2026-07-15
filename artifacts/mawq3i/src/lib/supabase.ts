import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Standard client — respects RLS (used by store owners)
export const supabase = createClient(supabaseUrl, supabaseKey);

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// Calls the server-side /api/secure-db proxy, which verifies the caller's
// identity (admin, or the store owner for the given storeId) before running
// any privileged, RLS-bypassing operation. The service_role key itself never
// leaves the server — see api/secure-db.js.
async function callSecureDb(payload: Record<string, unknown>): Promise<any> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Not authenticated');
  const res = await fetch('/api/secure-db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, ...payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `secure-db request failed: ${res.status}`);
  }
  return res.json();
}

// Admin/privileged helper — bypasses RLS via the authenticated server-side proxy.
// `storeId` should be passed whenever the operation is scoped to a single store,
// so non-admin (but store-owner) callers can be authorized too.
export const adminRest = {
  async select(table: string, query: string, storeId?: string): Promise<any[]> {
    try {
      const data = await callSecureDb({ action: 'select', table, query, storeId });
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
  async update(table: string, filter: string, body: object, storeId?: string): Promise<boolean> {
    try {
      await callSecureDb({ action: 'update', table, filter, body, storeId });
      return true;
    } catch {
      return false;
    }
  },
  async insert(table: string, body: object, storeId?: string): Promise<any | null> {
    try {
      const data = await callSecureDb({ action: 'insert', table, body, storeId });
      return Array.isArray(data) ? data[0] : data;
    } catch {
      return null;
    }
  },
  async delete(table: string, filter: string, storeId?: string): Promise<boolean> {
    try {
      await callSecureDb({ action: 'delete', table, filter, storeId });
      return true;
    } catch {
      return false;
    }
  },
  // Admin-only: creates a new Supabase Auth user (used when onboarding a new store owner)
  async authCreateUser(email: string, password: string): Promise<{ id: string } | null> {
    try {
      return await callSecureDb({ action: 'auth_create_user', body: { email, password } });
    } catch {
      return null;
    }
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
