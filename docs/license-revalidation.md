# License Revalidation System

## Overview

The Quack app implements a **periodic license revalidation system** to detect refunded, expired, or invalid licenses automatically. This ensures users with invalid licenses are switched back to the Free tier without manual intervention.

## How It Works

### 1. **Validation Frequency**
- License is revalidated **every 7 days**
- First validation happens immediately after license activation
- Subsequent validations happen on app startup (if 7 days have passed)

### 2. **Validation Process**

#### On App Startup (`App.tsx`):
```typescript
const bootstrap = async () => {
  // 💰 License revalidation check (every 7 days)
  const licenseData = getLicenseData();

  if (licenseData && needsRevalidation(licenseData.lastValidatedAt)) {
    const isStillValid = await revalidateLicense();

    if (!isStillValid) {
      // License is no longer valid - switch to Free tier
      toast.error('License Deactivated', {
        description: 'Your license is no longer valid. Switching to Free tier.',
      });
    }
  }
};
```

#### Backend API Call (`license.rs`):
```rust
#[tauri::command]
pub async fn revalidate_license(
    license_key: String,
    state: State<'_, LicenseState>,
) -> Result<serde_json::Value, String> {
    // POST to https://api.lemonsqueezy.com/v1/licenses/validate
    // Check license_key.status field
    // Valid statuses: "active", "inactive", "expired", "refunded"
}
```

### 3. **License Status Handling**

The system checks the `status` field from Lemon Squeezy API:

- ✅ **`active`**: License is valid, update `lastValidatedAt` timestamp
- ❌ **`inactive`**: License deactivated, clear local data
- ❌ **`expired`**: License expired, clear local data
- ❌ **`refunded`**: License refunded, clear local data

### 4. **User Experience**

#### Valid License:
- Silent revalidation in background
- `lastValidatedAt` timestamp updated
- No notification to user
- Pro features continue working

#### Invalid License:
- Toast notification appears: "License Deactivated"
- Local license data cleared from localStorage
- User switched to Free tier immediately
- Free tier limits enforced (3 terminals, 1 group, etc.)

### 5. **Error Handling**

#### Network Errors:
- If Lemon Squeezy API is unreachable (network issue), license is **assumed valid**
- Prevents disrupting users due to temporary network problems
- Next validation attempt in 7 days

#### API Errors:
- If API returns explicit "invalid" status, license is **immediately deactivated**
- Only clear license on confirmed invalid status from API

## Implementation Files

### Frontend
- **`src/config/features.ts`**:
  - `LicenseData` interface with `lastValidatedAt` field
  - `needsRevalidation()` function (checks if 7 days passed)
  - `revalidateLicense()` function (calls backend API)

- **`src/App.tsx`**:
  - Revalidation check in `bootstrap()` function on app startup

- **`src/components/LicenseModal.tsx`**:
  - Sets `lastValidatedAt` when license is first activated

### Backend
- **`src-tauri/src/license.rs`**:
  - `revalidate_license()` Tauri command
  - Uses `/licenses/validate` endpoint (not `/activate`)

- **`src-tauri/src/lib.rs`**:
  - Registers `revalidate_license` command

## Testing

### Test Scenario 1: Valid License
1. Activate a valid license
2. Wait 7 days (or manually set `lastValidatedAt` to 8 days ago)
3. Restart app
4. Expected: Silent revalidation, Pro features continue working

### Test Scenario 2: Refunded License
1. Activate a valid license
2. Issue a refund on Lemon Squeezy dashboard
3. Wait 7 days (or manually set `lastValidatedAt` to 8 days ago)
4. Restart app
5. Expected: Toast notification "License Deactivated", switched to Free tier

### Test Scenario 3: Network Error
1. Activate a valid license
2. Disable internet connection
3. Restart app
4. Expected: No disruption, license still valid (network error assumed temporary)

## Future Improvements

- **Manual Revalidation Button**: Add UI button to manually trigger revalidation (Settings → License)
- **Background Revalidation**: Check periodically while app is running (not just on startup)
- **Grace Period**: Allow 1-2 day grace period for network/API issues before deactivating
- **Revalidation History**: Log revalidation attempts and results for debugging

## Lemon Squeezy API Reference

- **Validate Endpoint**: `POST https://api.lemonsqueezy.com/v1/licenses/validate`
- **Docs**: https://docs.lemonsqueezy.com/api/license-keys#validate-a-license-key
- **Response Structure**:
  ```json
  {
    "valid": true,
    "license_key": {
      "status": "active",
      "key": "XXXX-XXXX-XXXX-XXXX",
      ...
    }
  }
  ```

## Notes

- Validation is **non-blocking** - app continues to load even if validation fails
- License data stored in localStorage (`quack_license_data` key)
- Backend requires `.env` file with `LEMON_SQUEEZY_API_KEY` and `LEMON_SQUEEZY_STORE_ID`
