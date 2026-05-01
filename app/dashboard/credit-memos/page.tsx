import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CreditMemosBrowser } from "@/components/credit-memos-browser";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isAdminUser } from "@/lib/is-admin-user";

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

export default async function CreditMemosPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = isAdminUser(session?.user?.name);

  if (!session?.user?.salespersonName) {
    redirect("/");
  }

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from("credit_memo_rows")
    .select(
      "customer_code,customer_name,credit_memo_no,credit_memo_date,item_no,item_descp,quantity,sales_amount,piece_price,salesperson,bp_email",
    )
    .order("customer_code", { ascending: true })
    .order("credit_memo_no", { ascending: false });

  if (!isAdmin) {
    query = query.eq("salesperson", session.user.salespersonName);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch credit memo rows", error);
    throw new Error("Failed to fetch credit memo rows");
  }

  const rows = ((data as CreditMemoRow[]) ?? [])
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
      (row): row is {
        customer_code: string;
        customer_name: string;
        credit_memo_no: string;
        credit_memo_date: string;
        item_no: string;
        item_descp: string;
        quantity: number;
        sales_amount: number;
        piece_price: number;
        salesperson: string | null;
        bp_email: string | null;
      } =>
        Boolean(
          row.customer_code &&
            row.customer_name &&
            row.credit_memo_no &&
            row.credit_memo_date &&
            row.item_no &&
            row.item_descp &&
            row.quantity !== null &&
            row.sales_amount !== null &&
            row.piece_price !== null,
        ),
    );

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Credit Memo Explorer</h1>
          <p className="text-sm text-zinc-600">Welcome, {session.user.salespersonName}</p>
        </div>
        <Link href="/dashboard" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50">Back</Link>
      </div>

      <CreditMemosBrowser rows={rows} />
    </main>
  );
}
