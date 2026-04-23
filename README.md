This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

This app requires Supabase and authentication variables used by existing flows.

For the credit request email delivery flow, configure the following server-side variables in local `.env` and Vercel project settings:

- `RESEND_API_KEY` - API key for your Resend account.
- `CREDIT_REQUEST_FROM_EMAIL` - Verified sender (for example `Credit Request <no-reply@yourdomain.com>`).

The credit request email recipient is fixed to `credit@turkanafood.com` in the server route.

## Credit Request Email Flow

- Cart items are reviewed in the Cart modal and sent via `POST /api/credit-request/send`.
- Email HTML is generated server-side with a business table layout and summary fields.
- Uploaded cart photos are attached to the email as file attachments.
- Sensitive keys are not exposed to the browser.
