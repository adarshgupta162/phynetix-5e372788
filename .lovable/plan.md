# Plan: Multi-Feature Rollout

This is a large request covering 8 distinct areas. I'll group them into phases so each piece can be tested before moving on. Confirm the order or tell me which to prioritize first.

---

### 1.1 Enrolled-students counter shows 0

- `batches.current_students` is never incremented. Add a Postgres trigger on `batch_enrollments` (AFTER INSERT/UPDATE/DELETE) that recomputes `current_students = count(active enrollments)` for the batch.
- Backfill existing counts with one UPDATE.

### 1.2 Admin password reset of other users not working

- Inspect `admin-reset-password` edge function logs, fix auth/service-role usage so an admin can set any user's password via `supabase.auth.admin.updateUserById`.

### 1.3 Solution page — image not visible + black bg + negative filter

- In `SolutionSection.tsx`: ensure both `solution_image_url` (legacy) + `solution_image_urls` merged via `mergeImageUrls`.
- Wrap each image in a `bg-black` container with a toggleable `invert` filter (button: "Invert colors"). Default ON per your note.

### 1.4 Bulk import — question option images

- Extend `BulkQuestionImport.tsx` schema: accept `option_a_image`, `option_b_image`, `option_c_image`, `option_d_image` columns (URLs). Map into `options` JSONB as `{text, image_url}`.
- Update sample CSV/XLSX template.

- Verify `LIVEKIT_URL/API_KEY/API_SECRET` secrets resolve (already present).
- In `useProctoring.ts`: on resume, ensure `publishStreams` is invoked AFTER permissions resolved and tracks attached; log + toast LiveKit connection failures.
- In `LiveMonitoring.tsx`: subscribe per active `proctoring_sessions` row, render camera + screen tiles. Auto-refresh when new session row appears (realtime on `proctoring_sessions`).
- Add a "no stream yet" placeholder vs actual error state so admins can tell the difference.

Pick ONE path — please confirm:

- **A) Lovable Payments (Stripe seamless)** — no key needed, 2.9%+30¢; I'll run `recommend_payment_provider` then `enable_stripe_payments`. Recommended.
- Edge fn `create-checkout` → creates order, returns session/order_id.
- Edge fn `payment-webhook` → on success, insert `payments` row + `batch_enrollments` row (enrollment_type=`paid`).
- Replace demo button in `CheckoutPage.tsx` with real flow.
- Apply coupon validation pre-checkout (validate against `coupons` table, write `coupon_usage`).

---

Build `/admin/finance` enhancements:

- **Transactions table**: list `payments` with filters (status, date, batch, user), CSV export.
- **Refunds**: refund button per payment → edge fn `refund-payment` (provider refund + update `payments.refund_*` + deactivate enrollment if full refund).
- **Coupons**: full CRUD already partly in `CouponManager.tsx` — add usage stats (uses, revenue impact).
- **Revenue dashboard**: cards for total revenue, refunds, net, by batch.

---

In `BatchManagement.tsx` / new `BatchDetailAdmin.tsx`:

- Per-batch drawer/page: enrolled students table (name, email, enrolled_at, payment status, expires_at), search, manual add/remove, export CSV.
- **Instruction customization**: add `instructions` (rich text) + `welcome_message` columns to `batches`; show to students on batch home.
- Quick actions: extend expiry, deactivate enrollment, resend access email.

---

## Database changes (summary)

```sql
-- Phase 1.1
CREATE FUNCTION recompute_batch_students() ...; -- trigger fn
CREATE TRIGGER on batch_enrollments;

-- Phase 5
ALTER TABLE batches ADD COLUMN instructions TEXT, ADD COLUMN welcome_message TEXT;

-- Phase 3/4
-- payments table already exists; may add: provider_subscription_id, invoice_url
```

---



Do all in one command use stripe and refund manual 