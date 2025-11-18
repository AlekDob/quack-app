# 🦆 Quack Pro - Gumroad Webhook Setup Guide

Complete guide to set up automatic license validation with Gumroad webhooks and Supabase.

---

## 📋 Overview

This setup eliminates the need for Gumroad API verification by using webhooks:

1. **Gumroad sends webhook** when someone purchases
2. **Supabase Edge Function receives it** and validates
3. **License saved automatically** to Supabase database
4. **App verifies license** against Supabase (not Gumroad API)
5. **100% automated** - no manual work required!

---

## 🚀 Step 1: Deploy Supabase Database Schema

### 1.1 Open Supabase SQL Editor

1. Go to: https://app.supabase.com/
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"**

### 1.2 Run the Schema

1. Open the file: `docs/SUPABASE_VALID_LICENSES_SCHEMA.sql`
2. Copy the entire SQL content
3. Paste into Supabase SQL Editor
4. Click **"Run"**

### 1.3 Verify Tables Created

1. Click **"Table Editor"** in left sidebar
2. You should see:
   - ✅ `valid_licenses` (new table for webhook data)
   - ✅ `license_devices` (existing table for device tracking)

---

## 🔧 Step 2: Deploy Supabase Edge Function

### 2.1 Install Supabase CLI (if not already installed)

```bash
# macOS
brew install supabase/tap/supabase

# Or download from: https://github.com/supabase/cli/releases
```

### 2.2 Login to Supabase

```bash
supabase login
```

### 2.3 Link Your Project

```bash
cd /Users/alekdob/Desktop/Dev/Personal/quack-app
supabase link --project-ref YOUR_PROJECT_REF
```

**Where to find PROJECT_REF:**
- Go to: https://app.supabase.com/project/YOUR_PROJECT/settings/general
- Copy "Reference ID"

### 2.4 Deploy the Edge Function

```bash
supabase functions deploy gumroad-webhook
```

### 2.5 Get the Function URL

After deployment, you'll see:
```
Deployed Function URLs:
  gumroad-webhook: https://YOUR_PROJECT_REF.supabase.co/functions/v1/gumroad-webhook
```

**Copy this URL** - you'll need it for Gumroad webhook configuration!

---

## 🔗 Step 3: Configure Gumroad Webhook

### 3.1 Open Gumroad Product Settings

1. Go to: https://app.gumroad.com/products
2. Click on **"Quack Pro"** product
3. Scroll to **"Advanced"** or **"Webhooks"** section

### 3.2 Add Webhook URL

1. Find **"Ping URL"** or **"Webhook URL"** field
2. Paste the Supabase Function URL:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/gumroad-webhook
   ```
3. **Save** the product

### 3.3 Test the Webhook (Optional)

Gumroad usually has a "Test Ping" button:
1. Click **"Send test ping"** or **"Test webhook"**
2. Check Supabase logs:
   ```bash
   supabase functions logs gumroad-webhook
   ```
3. You should see: `🦆 Received Gumroad webhook`

---

## 🔄 Step 4: Update Backend to Verify Against Supabase

Now we need to modify the Rust backend to check licenses against Supabase instead of Gumroad API.

### Changes needed in `src-tauri/src/license.rs`:

The backend will now:
1. ❌ **REMOVE** Gumroad API verification
2. ✅ **ADD** Supabase `valid_licenses` table lookup
3. ✅ **KEEP** device tracking on `license_devices` (unchanged)

**I'll create the updated `license.rs` in the next step!**

---

## ✅ Step 5: Test the Complete Flow

### 5.1 Make a Test Purchase

1. Set product price to **€1** (minimum)
2. Use test card: `4242 4242 4242 4242`
3. Complete purchase

### 5.2 Verify Webhook Received

Check Supabase logs:
```bash
supabase functions logs gumroad-webhook --tail
```

You should see:
```
🦆 Received Gumroad webhook
✅ License saved successfully
```

### 5.3 Verify License in Database

1. Go to Supabase **Table Editor**
2. Open `valid_licenses` table
3. You should see the new license:
   - ✅ `license_key`: The key from Gumroad email
   - ✅ `order_id`: Order number
   - ✅ `email`: Customer email
   - ✅ `is_valid`: `true`
   - ✅ `is_refunded`: `false`

### 5.4 Test in Quack App

1. Open Quack app
2. Create 4+ agents (trigger paywall)
3. Click "Already have a license? Activate"
4. Enter the license key from email
5. **Should activate successfully!**

---

## 📊 Monitoring & Debugging

### View Webhook Logs

```bash
# Real-time logs
supabase functions logs gumroad-webhook --tail

# Recent logs
supabase functions logs gumroad-webhook
```

### Check Database

```sql
-- See all valid licenses
SELECT license_key, email, is_valid, is_refunded, purchased_at
FROM valid_licenses
ORDER BY purchased_at DESC;

-- See device count per license
SELECT vl.license_key, vl.email, COUNT(ld.id) as device_count
FROM valid_licenses vl
LEFT JOIN license_devices ld ON vl.license_key = ld.license_key
GROUP BY vl.license_key, vl.email;
```

### Common Issues

#### Webhook Not Receiving Data
- ✅ Verify Function URL is correct in Gumroad
- ✅ Check function is deployed: `supabase functions list`
- ✅ Test with curl:
  ```bash
  curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/gumroad-webhook \
    -H "Content-Type: application/json" \
    -d '{"test": "data"}'
  ```

#### License Not Found in App
- ✅ Check `valid_licenses` table has the entry
- ✅ Verify backend is querying Supabase (not Gumroad API)
- ✅ Check license_key matches exactly (no extra spaces)

---

## 🎯 What Happens on Refund/Dispute?

When Gumroad sends a refund/dispute webhook:
1. ✅ Edge Function receives webhook
2. ✅ Updates `is_refunded`/`is_disputed` to `true`
3. ✅ Next revalidation in app will fail
4. ✅ User automatically downgraded to Free tier

**100% automated - no manual intervention needed!**

---

## 🔒 Security Notes

- ✅ **Webhook endpoint is public** (Gumroad needs to access it)
- ✅ **Supabase service_role** is used (bypasses RLS)
- ✅ **Row Level Security** protects data access
- ✅ **No sensitive keys** are exposed to clients

---

## 🚀 Production Checklist

Before launching:

- [ ] Supabase schema deployed
- [ ] Edge Function deployed and URL copied
- [ ] Gumroad webhook configured with Function URL
- [ ] Test purchase completed successfully
- [ ] License appears in `valid_licenses` table
- [ ] App activation works with test license
- [ ] Backend updated to use Supabase verification
- [ ] Product price set to final amount (€49/year)
- [ ] Checkout URL updated in `UpgradeModal.tsx`

---

**🦆 Quack quack! Once this is set up, everything is 100% automated! No more manual license management!**

---

_Last updated: 2025-11-10_
_Generated by Jack @ Quack Agency_
