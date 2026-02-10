---
type: bug
project: quack-app
created: +058024-04-08
migrated: true
---

# bug-fts-schema-mismatch-sync-error

3. **Car** (cars table) - Company vehicles

   - Used for company car km tracking (separate from mileage reimbursement)

4. **CarKm** (cars_km table) - Mileage entries for company cars

**Status Workflow**: pending → approved | rejected

**Currency**: EUR primary, with multi-currency support

**Date Handling**: Custom decoder for multiple Supabase date formats (ISO8601 with/without fractions, simple YYYY-MM-DD)
