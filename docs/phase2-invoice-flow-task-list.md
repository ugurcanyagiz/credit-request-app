# Phase 2 Task List (Customer -> Invoice flow)

This checklist is tailored to the current repository structure.

## Goal

After login:
1. Dashboard shows unique customers for the logged-in salesperson (already implemented).
2. Clicking a customer opens a customer detail screen.
3. Customer detail screen lists unique invoices for that customer, still filtered by the logged-in salesperson.

---

## File-by-file implementation tasks

### 1) `app/api/customers/route.ts`
- [ ] Keep current session check and salesperson filter logic.
- [ ] (Optional hardening) make uniqueness key `customer_code + customer_name` instead of only `customer_code`.
- [ ] Keep response shape: `{ customers: [{ customer_code, customer_name }] }`.

### 2) `components/dashboard-customers.tsx`
- [ ] Convert each customer row into a clickable `Link`.
- [ ] Link target format: `/dashboard/customers/[customerCode]`.
- [ ] Pass `customer_name` via query string only for UI convenience (optional).
- [ ] Keep sign-out button as-is.

### 3) `app/dashboard/customers/[customerCode]/page.tsx` (new)
- [ ] Add a protected page for customer details.
- [ ] Read session server-side with `getServerSession(authOptions)`.
- [ ] Redirect to `/` when no session/salesperson.
- [ ] Render page title with selected customer code (and optional customer name).
- [ ] Render a client component that fetches invoice list from API.

### 4) `app/api/customers/[customerCode]/invoices/route.ts` (new)
- [ ] Add GET endpoint for invoice listing.
- [ ] Read session server-side and get `salespersonName`.
- [ ] Query `credit_rows` with filters:
  - `salesperson = session.user.salespersonName`
  - `customer_code = route customerCode`
- [ ] Select only `invoice_no`.
- [ ] Return unique `invoice_no` values.
- [ ] Return `401` when unauthorized; `500` for query errors.

### 5) `components/customer-invoices.tsx` (new)
- [ ] Client component that calls `/api/customers/[customerCode]/invoices`.
- [ ] Display loading/error/empty states.
- [ ] Show invoice numbers as selectable rows/buttons.
- [ ] Keep design consistent with current dashboard components.

### 6) `app/dashboard/page.tsx`
- [ ] Keep existing protection and salesperson context display.
- [ ] Optionally add helper text: "Select a customer to view invoices".

### 7) `types` (only if needed)
- [ ] Add/extend local types for invoice API response.
- [ ] No NextAuth type changes required for this phase.

---

## Suggested API contracts

### `GET /api/customers`
```json
{
  "customers": [
    { "customer_code": "C12491", "customer_name": "Saraga International Grocery #3" }
  ]
}
```

### `GET /api/customers/:customerCode/invoices`
```json
{
  "invoices": [
    { "invoice_no": "94466" },
    { "invoice_no": "94470" }
  ]
}
```

---

## Manual Supabase SQL (run manually, optional but recommended)

If invoice listing gets slow on larger data, run this index in Supabase SQL Editor:

```sql
create index if not exists idx_credit_rows_salesperson_customer_invoice
  on public.credit_rows (salesperson, customer_code, invoice_no);
```

No destructive schema change is required for this phase.

---

## Acceptance checklist

- [ ] Logged-in user sees only own customers.
- [ ] Clicking a customer opens customer detail route.
- [ ] Customer detail route lists only invoices belonging to:
  - selected `customer_code`
  - logged-in `salesperson`
- [ ] Unauthorized users cannot access dashboard/customer APIs.
- [ ] No service role key is exposed client-side.
