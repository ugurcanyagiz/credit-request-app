import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreditMemoRow = {
  credit_memo_no: string | null;
  credit_memo_date: string | null;
};

export async function GET(_request: Request, context: RouteContext<"/api/customers/[customerCode]/credit-memos">) {
  const session = await getServerSession(authOptions);
  const salespersonName = session?.user?.salespersonName;
  const isAdmin = isAdminUser(session?.user?.name);

  if (!salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { customerCode: rawCustomerCode } = await context.params;
  const customerCode = decodeURIComponent(rawCustomerCode);

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from("credit_memo_rows")
    .select("credit_memo_no,credit_memo_date")
    .eq("customer_code", customerCode)
    .order("credit_memo_no", { ascending: false });

  if (!isAdmin) {
    query = query.eq("salesperson", salespersonName);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch customer credit memos", error);
    return Response.json({ error: "Failed to fetch customer credit memos" }, { status: 500 });
  }

  const uniqueByMemoNo = new Map<string, { credit_memo_no: string; credit_memo_date: string | null }>();

  for (const row of (data as CreditMemoRow[]) ?? []) {
    if (!row.credit_memo_no || uniqueByMemoNo.has(row.credit_memo_no)) {
      continue;
    }

    uniqueByMemoNo.set(row.credit_memo_no, {
      credit_memo_no: row.credit_memo_no,
      credit_memo_date: row.credit_memo_date,
    });
  }

  return Response.json({ creditMemos: Array.from(uniqueByMemoNo.values()) });
}
