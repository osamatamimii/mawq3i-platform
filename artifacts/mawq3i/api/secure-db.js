// Authenticated proxy for privileged (RLS-bypassing) database operations.
//
// WHY THIS FILE EXISTS: previously, the Supabase service_role key (which bypasses
// all Row Level Security) was hardcoded directly in frontend source files, meaning
// it shipped inside the public JS bundle for anyone to extract from their browser
// and get full read/write access to the entire database. This endpoint replaces
// that pattern: the service_role key now lives ONLY here, server-side, as an
// environment variable — and every call is authenticated + authorized before it
// touches the database.
//
// Authorization model:
//   - Caller must send a valid Supabase access token (from their own logged-in session).
//   - If the token belongs to the platform admin (ADMIN_EMAIL), any allowlisted
//     table/operation is permitted (mirrors the old "isAdminMode" behavior).
//   - Otherwise, the caller must pass a storeId, and we verify they actually own
//     that store (stores.owner_id === caller's user id) before allowing the operation,
//     scoped only to that store's data.
//   - Table names are restricted to an explicit allowlist regardless of caller.

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL = 'admin@mawq3i.com';

const ALLOWED_TABLES = new Set([
  'products', 'bundles', 'orders', 'reviews', 'stores', 'store_staff',
  'offline_sales', 'promotions', 'discount_codes', 'abandoned_carts',
  'ai_image_generations', 'feature_usage_events', 'subscription_plans',
]);

const SERVICE_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function getCallerFromToken(accessToken) {
  if (!accessToken || !ANON_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    const user = await r.json();
    if (!user?.id) return null;
    return { id: user.id, email: (user.email || '').toLowerCase() };
  } catch {
    return null;
  }
}

async function verifyStoreOwnership(storeId, userId) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${encodeURIComponent(storeId)}&select=owner_id`, {
      headers: SERVICE_HEADERS,
    });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0] && rows[0].owner_id === userId;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!SERVICE_KEY) {
    res.status(500).json({ error: 'secure-db is not configured (missing SUPABASE_SERVICE_ROLE_KEY)' });
    return;
  }

  try {
    const { accessToken, action, table, query, filter, body, storeId } = req.body || {};

    if (!ALLOWED_TABLES.has(table) && action !== 'auth_create_user') {
      res.status(400).json({ error: 'Table not allowed' });
      return;
    }
    if (!['select', 'insert', 'update', 'delete', 'auth_create_user'].includes(action)) {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    const caller = await getCallerFromToken(accessToken);
    if (!caller) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const isAdmin = caller.email === ADMIN_EMAIL;

    // Creating a new Supabase Auth user (used only when onboarding a new store
    // owner) is inherently a platform-admin-only operation — it can't be scoped
    // to a store the way table CRUD can, since the store doesn't exist yet.
    if (action === 'auth_create_user') {
      if (!isAdmin) {
        res.status(403).json({ error: 'Admin only' });
        return;
      }
      const { email, password } = body || {};
      if (!email || !password) {
        res.status(400).json({ error: 'Missing email or password' });
        return;
      }
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: SERVICE_HEADERS,
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      if (!authRes.ok) {
        const errText = await authRes.text();
        res.status(authRes.status).json({ error: 'Failed to create auth user', detail: errText.slice(0, 300) });
        return;
      }
      const userData = await authRes.json();
      res.status(200).json({ id: userData?.id ?? null });
      return;
    }

    if (!isAdmin) {
      if (!storeId) {
        res.status(403).json({ error: 'storeId is required for non-admin callers' });
        return;
      }
      const owns = await verifyStoreOwnership(storeId, caller.id);
      if (!owns) {
        res.status(403).json({ error: 'Not authorized for this store' });
        return;
      }
    }

    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    let method = 'GET';
    let fetchBody;
    let extraHeaders = {};

    if (action === 'select') {
      url += `?${query || ''}`;
      method = 'GET';
    } else if (action === 'insert') {
      method = 'POST';
      fetchBody = JSON.stringify(body || {});
      extraHeaders = { Prefer: 'return=representation' };
    } else if (action === 'update') {
      url += `?${filter || ''}`;
      method = 'PATCH';
      fetchBody = JSON.stringify(body || {});
      extraHeaders = { Prefer: 'return=representation' };
    } else if (action === 'delete') {
      url += `?${filter || ''}`;
      method = 'DELETE';
    }

    const upstream = await fetch(url, {
      method,
      headers: { ...SERVICE_HEADERS, ...extraHeaders },
      body: fetchBody,
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status).json({ error: 'Database operation failed', detail: errText.slice(0, 300) });
      return;
    }

    const text = await upstream.text();
    const data = text ? JSON.parse(text) : null;
    res.status(200).json(action === 'insert' ? (Array.isArray(data) ? data[0] : data) : data);
  } catch (err) {
    console.error('secure-db handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
