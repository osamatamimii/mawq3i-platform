// Auto-creates a real Supabase Auth login account for a store_staff row,
// so store owners never need to ask us to create staff logins manually.
// Uses the Supabase Admin Auth API (service role key) to create a confirmed
// user with a randomly generated temporary password, then links that user's
// id back onto the store_staff row.

const SUPABASE_URL = 'https://mbenszegcjmwgmbjylbf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZW5zemVnY2ptd2dtYmp5bGJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3Nzg2OSwiZXhwIjoyMDkzNTUzODY5fQ.LmCOC7T9iC2SuKzRH9aVeUz0eml8RM95chPGMQgvuFo';
const ADMIN_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

function generateTempPassword() {
  // 10 chars, letters + digits, avoids ambiguous characters (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

async function findExistingUserByEmail(email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: ADMIN_HEADERS,
  });
  if (!r.ok) return null;
  const data = await r.json();
  const users = Array.isArray(data) ? data : data?.users;
  if (!Array.isArray(users) || !users.length) return null;
  const match = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  return match || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { staffId, email, fullName } = req.body || {};
    if (!staffId || !email || !String(email).trim()) {
      res.status(400).json({ error: 'Missing staffId or email' });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();

    // 1) Try to create a brand-new confirmed auth user with a temp password
    const generatedPassword = generateTempPassword();
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: ADMIN_HEADERS,
      body: JSON.stringify({
        email: cleanEmail,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName || '', role: 'staff' },
      }),
    });

    let userId = null;
    let tempPassword = null;
    let alreadyExisted = false;

    if (createRes.ok) {
      const created = await createRes.json();
      userId = created?.id || null;
      tempPassword = generatedPassword;
    } else {
      const errText = await createRes.text();
      const alreadyRegistered = createRes.status === 422 || /already.*registered|already.*exists/i.test(errText);
      if (!alreadyRegistered) {
        console.error('create-staff-account: auth create failed', createRes.status, errText);
        res.status(502).json({ error: 'تعذّر إنشاء الحساب', detail: errText.slice(0, 300) });
        return;
      }
      // 2) Email already has an auth account somewhere — link to it instead
      const existing = await findExistingUserByEmail(cleanEmail);
      if (!existing) {
        res.status(409).json({ error: 'البريد مستخدم مسبقاً ولم نتمكن من إيجاد الحساب' });
        return;
      }
      userId = existing.id;
      alreadyExisted = true;
    }

    // 3) Link the auth user id back onto the store_staff row
    const linkRes = await fetch(`${SUPABASE_URL}/rest/v1/store_staff?id=eq.${staffId}`, {
      method: 'PATCH',
      headers: { ...ADMIN_HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!linkRes.ok) {
      const t = await linkRes.text();
      console.error('create-staff-account: link failed', linkRes.status, t);
    }

    res.status(200).json({
      success: true,
      userId,
      email: cleanEmail,
      tempPassword: alreadyExisted ? null : tempPassword,
      alreadyExisted,
    });
  } catch (err) {
    console.error('create-staff-account handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
