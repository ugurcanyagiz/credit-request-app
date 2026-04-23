# Cart photo hosting setup (required for persisted cart photo rendering)

This feature uploads cart photos to Supabase Storage and persists photo mappings in SQL so photos survive modal close/reopen and page refresh.
Photos are uploaded as soon as users pick them in the cart UI, and those uploaded photos are reloaded from SQL by stable cart draft id.

## Minimum required Supabase objects

1. **Storage bucket** (required): `credit-request-cart-photos`.
2. **Storage policies** (required): allow the app's server-side service role to upload/read/delete objects.
3. **SQL table** (required): `public.credit_request_cart_drafts`.
4. **SQL table** (required): `public.credit_request_photos`.

## Step 1: Create/confirm Storage bucket (Required)

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

## Step 3: Persisted cart draft and photo tables (Required)

Run this SQL in **Supabase SQL Editor**:

```sql
create extension if not exists pgcrypto;

create table if not exists public.credit_request_cart_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  salesperson text not null,
  linked_credit_request_id uuid null references public.credit_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (user_id, salesperson)
);

create table if not exists public.credit_request_photos (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.credit_request_cart_drafts(id) on delete cascade,
  file_name text not null,
  public_url text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists credit_request_photos_draft_id_created_at_idx
  on public.credit_request_photos (draft_id, created_at desc);
```

## Required environment variables

Already used by current server-side Supabase access:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLIC_URL` (recommended when your server uses an internal Supabase URL; this must be browser-reachable and is used for email/public image links)

New optional override (defaults to `credit-request-cart-photos`):

- `SUPABASE_CART_PHOTOS_BUCKET`
