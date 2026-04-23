This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

This app requires Supabase and authentication variables used by existing flows.

The credit request flow now prepares a hosted HTML draft with Supabase Storage image URLs.
It does not require provider-specific email credentials yet, but does require Supabase Storage bucket setup.

## Credit Request Email Flow

- Cart items are reviewed in the Cart modal and sent to `/api/cart/credit-request-draft`.
- Uploaded photos are stored in Supabase Storage and included as real image URLs in generated HTML content.
- The UI shows an HTML draft preview with visual photos and provides plain-text copy support.
- The recipient remains `credit@turkanafood.com` in business flow messaging.


See `docs/cart-photo-storage-setup.md` for required Supabase bucket and policy setup.
