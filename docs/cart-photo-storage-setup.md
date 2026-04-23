# Cart photo hosting setup (required for HTML photo rendering)

This feature uploads cart photos to Supabase Storage and renders real image URLs in a hosted HTML credit request draft.

## Minimum required Supabase objects

1. **Storage bucket** (required): `credit-request-cart-photos`.
2. **Storage policies** (required): allow the app's server-side service role to upload/read/delete objects.
3. **No new SQL table is required** for the current minimal architecture.

## Step 1: Create Storage bucket (Required)

In **Supabase Dashboard → Storage → New bucket**:

- Bucket name: `credit-request-cart-photos`
- Public bucket: **ON** (required for stable image URLs in HTML emails/drafts)
- File size limit: `10 MB` (recommended to match API validation)
- Allowed MIME types: include `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`

Why required: public URLs are generated and embedded directly in HTML, which allows visual rendering in email clients and previews.

## Step 2: Storage SQL policies (Required)

Run this SQL in **Supabase SQL Editor**:

```sql
-- Ensure the bucket exists and is public.
insert into storage.buckets (id, name, public)
values ('credit-request-cart-photos', 'credit-request-cart-photos', true)
on conflict (id) do update set public = excluded.public;

-- Keep object access limited to backend service role operations.
create policy "service role can manage credit request cart photos"
on storage.objects
as permissive
for all
to service_role
using (bucket_id = 'credit-request-cart-photos')
with check (bucket_id = 'credit-request-cart-photos');
```

Why required: uploads are performed in `app/api/cart/credit-request-draft/route.ts` using the server-side service role client.

## Optional hardening and tradeoffs

### Option A (Current implementation): Public bucket + random object paths

- **Pros**: image URLs do not expire; best reliability for email rendering.
- **Cons**: anyone with the exact URL can view the image.

### Option B (Alternative): Private bucket + signed URLs

- **Pros**: tighter access control.
- **Cons**: URLs expire and photos may stop rendering in old emails.

If you switch to signed URLs later, update the API route to generate `createSignedUrl(...)` and communicate expiration behavior to users.

## Required environment variables

Already used by current server-side Supabase access:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

New optional override (defaults to `credit-request-cart-photos`):

- `SUPABASE_CART_PHOTOS_BUCKET`
