# Brevo Email Service Setup Guide

**Purpose:** Email verification for user registration and email-bound invite system

**Service:** Brevo (formerly Sendinblue)
**Free Tier:** 9,000 emails/month (300 emails/day)
**Cost:** $0 for MVP

---

## Quick Setup (5 minutes)

### 1. Create Brevo Account

1. Visit: [https://app.brevo.com/account/register](https://app.brevo.com/account/register)
2. Sign up with your email
3. Verify your email address
4. Complete account setup (skip marketing features for now)

### 2. Generate API Key

1. Log in to Brevo dashboard
2. Navigate to: **Settings** → **SMTP & API** → **API Keys**
3. Click **"Generate a new API key"**
4. Name: `OurChat Development` (or `OurChat Production` for production)
5. Copy the API key (starts with `xkeysib-`)
   - **Important:** Save it immediately - you can't view it again!

### 3. Configure Environment Variables

**Frontend (`.env.local`):**

```bash
# Brevo Email Service
BREVO_API_KEY=xkeysib_your-actual-api-key-here
EMAIL_FROM=noreply@yourdomain.com  # Or your personal email for testing
EMAIL_FROM_NAME=OurChat
EMAIL_VERIFICATION_URL=http://localhost:3002/verify-email

# Generate invite secret (one time)
# Run: openssl rand -hex 32
INVITE_SECRET=<paste-64-char-hex-string-here>
```

**Backend (`apps/backend/.env`):**

```bash
# Brevo Email Service (same as frontend)
BREVO_API_KEY=xkeysib_your-actual-api-key-here
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=OurChat
EMAIL_VERIFICATION_URL=http://localhost:3002/verify-email

# Invite secret (MUST match frontend)
INVITE_SECRET=<same-64-char-hex-string-from-frontend>
```

### 4. Generate Invite Secret

**Run once:**

```bash
openssl rand -hex 32
```

**Copy the output** (64 characters) and paste into **both** `.env.local` and `apps/backend/.env`

⚠️ **CRITICAL:** The `INVITE_SECRET` must be identical in both frontend and backend!

### 5. Restart Backend

```bash
docker-compose restart backend
```

---

## Testing Email Delivery

### Test Verification Email

1. Start the application: `pnpm dev`
2. Register a new account with your real email
3. Check your inbox for verification email
4. Click the verification link

**Expected:**
- Email arrives within 30 seconds
- Subject: "Verify your email - OurChat"
- Link redirects to: `http://localhost:3002/verify-email?token=...`

### Check Brevo Dashboard

1. Go to: **Campaigns** → **Transactional** → **Logs**
2. View recent email deliveries
3. Check delivery status, open rates, click rates

---

## Email Configuration Options

### Sender Email (`EMAIL_FROM`)

**Development:**
- Use your personal email (e.g., `yourname@gmail.com`)
- Brevo will send from your verified email address
- Requires email verification in Brevo

**Production:**
- Use a dedicated domain email (e.g., `noreply@yourdomain.com`)
- Requires domain verification in Brevo
- Better deliverability and professional appearance

### Domain Verification (Production Only)

**Why:** Improves deliverability, prevents emails going to spam

**Steps:**
1. Brevo dashboard → **Senders, Domains & Dedicated IPs** → **Domains**
2. Click **"Add a Domain"**
3. Enter your domain (e.g., `yourdomain.com`)
4. Add DNS records (SPF, DKIM, DMARC) to your domain registrar
5. Wait for verification (can take 24-48 hours)

**Not required for local development** - skip until production deployment

---

## Troubleshooting

### Emails Not Arriving

**Check Brevo Logs:**
1. Dashboard → **Campaigns** → **Transactional** → **Logs**
2. Look for your email in the list
3. Check status: "Sent", "Delivered", "Bounced", "Blocked"

**Common Issues:**

| Problem | Solution |
|---------|----------|
| "Invalid API key" | Regenerate key in Brevo dashboard, update `.env` files |
| Email goes to spam | Use verified sender domain, check SPF/DKIM records |
| "Sender not verified" | Verify your email in Brevo: Settings → Senders → Verify |
| Rate limit exceeded | Free tier: 300/day max. Wait 24 hours or upgrade plan |
| Backend can't send | Check `BREVO_API_KEY` in `apps/backend/.env`, restart backend |

### Backend Connection Issues

```bash
# Check backend logs
docker-compose logs backend | grep -i brevo

# Check environment variables loaded
docker-compose exec backend env | grep BREVO

# Restart backend
docker-compose restart backend
```

### API Key Rotation

**To rotate API key:**
1. Generate new key in Brevo dashboard
2. Update `.env.local` and `apps/backend/.env`
3. Restart backend: `docker-compose restart backend`
4. Delete old key from Brevo dashboard

---

## Free Tier Limits

| Resource | Limit |
|----------|-------|
| **Emails per month** | 9,000 |
| **Emails per day** | 300 |
| **Contacts** | Unlimited |
| **Email templates** | Unlimited |
| **API calls** | Unlimited |
| **Support** | Email only |

### Monitoring Usage

**Dashboard → Account → Plan Details**
- View current month usage
- Set up alerts at 80% usage
- Upgrade to paid plan if needed

### Upgrade Plans (if needed)

| Plan | Price | Emails/Month |
|------|-------|--------------|
| **Free** | $0 | 9,000 |
| **Starter** | $15/mo | 20,000 |
| **Business** | $25/mo | 40,000 |
| **Enterprise** | $65/mo | 100,000 |

**For MVP:** Free tier is adequate (estimated 1,000-2,000 emails/month)

---

## Security Best Practices

### Protect API Keys

✅ **DO:**
- Store API keys in `.env` files (never commit to git)
- Use different API keys for dev/staging/production
- Rotate keys every 90 days
- Use `.env.example` files without real keys

❌ **DON'T:**
- Commit `.env` files to git
- Share API keys in Slack/email
- Use production keys in development
- Hardcode keys in source code

### Invite Secret Security

The `INVITE_SECRET` encrypts invitee email addresses in invite codes.

**Requirements:**
- ✅ 64 characters (32 bytes hex)
- ✅ Cryptographically random (use `openssl rand -hex 32`)
- ✅ Identical in frontend and backend
- ✅ Never committed to git
- ✅ Rotated every 6-12 months

**To rotate:**
1. Generate new secret: `openssl rand -hex 32`
2. Update both `.env.local` and `apps/backend/.env`
3. Restart backend
4. **Note:** Old invite codes will become invalid!

---

## Email Templates (Story 1.4)

Brevo email templates will be created in **Story 1.4** implementation.

**Templates to create:**
1. **Email Verification** - Sent after registration
2. **Welcome Email** - Sent after verification complete
3. **Password Reset** - (Future story)
4. **Invite Notification** - (Future story - notify admin when invite accepted)

**Template variables:**
- `{{userName}}` - User's display name
- `{{verificationLink}}` - Email verification URL
- `{{familyName}}` - Family name
- `{{inviteCode}}` - Family invite code

---

## Production Deployment Notes

**Environment Variables (Production):**

```bash
# Use production URLs
EMAIL_VERIFICATION_URL=https://yourdomain.com/verify-email

# Use dedicated sender domain
EMAIL_FROM=noreply@yourdomain.com

# Generate production-specific keys
BREVO_API_KEY=xkeysib_production-key-here
INVITE_SECRET=<different-64-char-hex-for-production>
```

**GitHub Secrets (for CI/CD):**

Add to GitHub repository secrets:
- `BREVO_API_KEY_STAGING`
- `BREVO_API_KEY_PRODUCTION`
- `INVITE_SECRET_STAGING`
- `INVITE_SECRET_PRODUCTION`

**Staging vs Production:**
- Use separate Brevo API keys
- Use separate invite secrets
- Monitor usage separately
- Test email delivery in staging first

---

## Support & Resources

**Brevo Documentation:**
- API Reference: https://developers.brevo.com/reference
- Transactional Email Guide: https://developers.brevo.com/docs/send-a-transactional-email
- NestJS Integration: https://www.npmjs.com/package/@getbrevo/brevo

**OurChat Docs:**
- Sprint Change Proposal: `docs/sprint-change-proposal-2025-11-08.md`
- Story 1.4: Email Verification (to be created)
- Story 1.5: Email-Bound Invites (to be created)
- Story 1.6: Brevo Integration (to be created)

**Need Help?**
- Check Brevo status: https://status.brevo.com
- Brevo support: support@brevo.com (free tier: email only)
- Internal team: Contact developer or architect

---

**Setup Complete!** 🎉

You're now ready to implement email verification (Story 1.4) and email-bound invites (Story 1.5).
