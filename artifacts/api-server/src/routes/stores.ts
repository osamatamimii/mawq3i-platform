import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { createSupabaseUser } from '../lib/supabaseAdmin.js';
import { getUncachableResendClient } from '../lib/resend.js';
import { logger } from '../lib/logger.js';

const router: IRouter = Router();

const CreateStoreBody = z.object({
  storeName: z.string().min(1),
  storeSlug: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerName: z.string().optional().default(''),
  currency: z.enum(['ILS', 'SAR']).default('ILS'),
  appUrl: z.string().default('https://mawq3i.com'),
});

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function buildWelcomeEmail({
  ownerName,
  storeName,
  ownerEmail,
  password,
  storeUrl,
  loginUrl,
}: {
  ownerName: string;
  storeName: string;
  ownerEmail: string;
  password: string;
  storeUrl: string;
  loginUrl: string;
}): string {
  const displayName = ownerName || 'صاحب المتجر';
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>مرحباً بك في موقعي</title>
</head>
<body style="margin:0;padding:0;background:#070a0d;font-family:'Cairo',Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#070a0d;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0d1117;border-radius:16px;border:1px solid #1e2830;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a1a0a 0%,#0d1f0d 100%);padding:32px 40px;text-align:center;border-bottom:1px solid #1e2830;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <span style="font-size:28px;font-weight:900;color:#52FF3F;letter-spacing:-1px;">Mawq3i</span>
                <span style="color:#ffffff80;font-size:18px;">|</span>
                <span style="font-size:22px;font-weight:700;color:#ffffff;">موقعي</span>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#ffffff;">
                أهلاً وسهلاً ${displayName}! 🎉
              </h1>
              <p style="margin:0 0 28px;color:#8b9aad;font-size:15px;line-height:1.7;">
                تم إنشاء متجرك <strong style="color:#52FF3F;">${storeName}</strong> بنجاح على منصة موقعي.
                فيما يلي بيانات دخولك إلى لوحة التحكم.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1520;border:1px solid #1e3a52;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#52FF3F;text-transform:uppercase;letter-spacing:1px;">بيانات تسجيل الدخول</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #1e2830;">
                          <span style="color:#8b9aad;font-size:13px;">البريد الإلكتروني</span>
                        </td>
                        <td style="padding:8px 0;border-bottom:1px solid #1e2830;text-align:left;" dir="ltr">
                          <code style="color:#ffffff;font-size:14px;font-family:monospace;">${ownerEmail}</code>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0 0;">
                          <span style="color:#8b9aad;font-size:13px;">كلمة المرور</span>
                        </td>
                        <td style="padding:8px 0 0;text-align:left;" dir="ltr">
                          <code style="color:#52FF3F;font-size:16px;font-weight:700;font-family:monospace;background:#0d1a0d;padding:4px 10px;border-radius:6px;">${password}</code>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Store URL box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1520;border:1px solid #1e3a52;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#52FF3F;text-transform:uppercase;letter-spacing:1px;">رابط متجرك</p>
                    <a href="${storeUrl}" style="color:#60a5fa;font-size:15px;font-family:monospace;text-decoration:none;" dir="ltr">${storeUrl}</a>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display:inline-block;background:#52FF3F;color:#070a0d;font-size:16px;font-weight:800;padding:14px 40px;border-radius:10px;text-decoration:none;">
                      تسجيل الدخول الآن ←
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#8b9aad;font-size:13px;line-height:1.7;text-align:center;">
                يُنصح بتغيير كلمة المرور بعد أول تسجيل دخول.<br/>
                في حال واجهتك أي مشكلة، تواصل معنا عبر الدعم الفني.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#080b0f;padding:20px 40px;text-align:center;border-top:1px solid #1e2830;">
              <p style="margin:0;color:#4a5568;font-size:12px;">© 2026 Mawq3i | موقعي — جميع الحقوق محفوظة</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

router.post('/stores/create-with-user', async (req, res) => {
  const parsed = CreateStoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
    return;
  }

  const { storeName, storeSlug, ownerEmail, ownerName, currency, appUrl } = parsed.data;
  const password = generatePassword();

  try {
    // 1. Create Supabase auth user
    const { userId } = await createSupabaseUser(ownerEmail, password);
    req.log.info({ userId, ownerEmail }, 'Supabase user created');

    // 2. Send welcome email via Resend
    const storeUrl = `${appUrl}/store/${storeSlug}`;
    const loginUrl = `${appUrl}/login`;
    const { client: resend, fromEmail } = await getUncachableResendClient();

    const { error: emailError } = await resend.emails.send({
      from: fromEmail || 'Mawq3i <noreply@mawq3i.com>',
      to: ownerEmail,
      subject: `🎉 مرحباً بك في موقعي — متجرك ${storeName} جاهز!`,
      html: buildWelcomeEmail({ ownerName, storeName, ownerEmail, password, storeUrl, loginUrl }),
    });

    if (emailError) {
      req.log.warn({ emailError }, 'Email send failed but user was created');
    }

    res.json({ success: true, userId, emailSent: !emailError, password });
  } catch (err: any) {
    req.log.error({ err }, 'Failed to create store user');
    res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

export default router;
