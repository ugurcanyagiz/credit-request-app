import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreditMemoRow = {
  customer_code: string | null;
  customer_name: string | null;
  credit_memo_no: string | null;
  credit_memo_date: string | null;
  item_no: string | null;
  item_descp: string | null;
  quantity: number | string | null;
  sales_amount: number | string | null;
  piece_price: number | string | null;
  salesperson: string | null;
  bp_email: string | null;
};

function toNumber(value: number | string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const salespersonName = session?.user?.salespersonName;

  if (!salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = isAdminUser(session?.user?.name);
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  const rows: CreditMemoRow[] = [];

  while (hasMore) {
    const to = from + pageSize - 1;
    let query = supabaseAdmin
      .from("credit_memo_rows")
      .select(
        "customer_code,customer_name,credit_memo_no,credit_memo_date,item_no,item_descp,quantity,sales_amount,piece_price,salesperson,bp_email",
      )
      .order("customer_code", { ascending: true })
      .order("credit_memo_no", { ascending: false })
      .range(from, to);

    if (!isAdmin) {
      query = query.eq("salesperson", salespersonName);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch credit memos", error);
      return Response.json({ error: "Failed to fetch credit memos" }, { status: 500 });
    }

    const chunk = (data as CreditMemoRow[]) ?? [];
    rows.push(...chunk);
    hasMore = chunk.length === pageSize;
    from += pageSize;
  }

  const sanitized = rows
    .map((row) => ({
      customer_code: row.customer_code,
      customer_name: row.customer_name,
      credit_memo_no: row.credit_memo_no,
      credit_memo_date: row.credit_memo_date,
      item_no: row.item_no,
      item_descp: row.item_descp,
      quantity: toNumber(row.quantity),
      sales_amount: toNumber(row.sales_amount),
      piece_price: toNumber(row.piece_price),
      salesperson: row.salesperson,
      bp_email: row.bp_email,
    }))
    .filter(
      (row) =>
        row.customer_code &&
        row.customer_name &&
        row.credit_memo_no &&
        row.credit_memo_date &&
        row.item_no &&
        row.item_descp &&
        row.quantity !== null &&
        row.sales_amount !== null &&
        row.piece_price !== null,
    );

  return Response.json({ rows: sanitized });
}
