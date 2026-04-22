# Phase 1 setup

## Required environment variables

Set these in Vercel (and locally when testing):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` is used only in server-side modules and route handlers.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in browser/client code.
