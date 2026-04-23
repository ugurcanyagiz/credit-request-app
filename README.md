This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

This app requires Supabase and authentication variables used by existing flows.

The credit request flow uses a client-side `mailto:` draft and does not require provider-specific email credentials.

## Credit Request Email Flow

- Cart items are reviewed in the Cart modal and used to construct a `mailto:` draft.
- The draft subject and body are generated dynamically from current cart data.
- Uploaded cart photos are listed as readable references in the message body (not attached files).
- The recipient is fixed to `credit@turkanafood.com`.
