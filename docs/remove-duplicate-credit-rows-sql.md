# Remove duplicate credit rows RPC

Run this SQL in the Supabase SQL editor before using the admin dashboard
**Duplicate Remove** button. The dashboard calls the server-side admin API, which
checks the NextAuth session/admin user before calling this Supabase RPC. Keep the
service role key on the server only.

The current RPC removes duplicates in batches and returns the number of rows
removed by that single call. The frontend repeats the admin API call until the
RPC returns `0`.

```sql
create or replace function public.remove_duplicate_credit_rows()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_limit integer := 2000;
  deleted_count integer;
begin
  with duplicate_rows as (
    select id
    from (
      select
        id,
        row_number() over (
          partition by
            customer_code,
            invoice_no,
            item_no,
            quantity,
            piece_price
          order by id
        ) as rn
      from public.credit_rows
    ) ranked_rows
    where ranked_rows.rn > 1
    limit batch_limit
  )
  delete from public.credit_rows
  where id in (select id from duplicate_rows);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
```

If you expose this function to non-service Supabase roles, prefer granting only
`execute` on this RPC to the minimum role that needs it, and keep table policies
restrictive. Do not put the service role key in frontend code.

```sql
revoke all on function public.remove_duplicate_credit_rows() from public;
grant execute on function public.remove_duplicate_credit_rows() to authenticated;
```
