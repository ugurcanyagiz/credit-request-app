import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreditMemoItemRow = {
  customer_name: string | null;
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

export default async function CreditMemoItemsPage({ params }: { params: Promise<{ customerCode: string; creditMemoNo: string }> }) {
  const session = await getServerSession(authOptions);
  const isAdmin = isAdminUser(session?.user?.name);

  if (!session?.user?.salespersonName) redirect("/");

  const { customerCode: rawCustomerCode, creditMemoNo: rawCreditMemoNo } = await params;
  const customerCode = decodeURIComponent(rawCustomerCode);
  const creditMemoNo = decodeURIComponent(rawCreditMemoNo);

  let query = getSupabaseAdmin()
    .from("credit_memo_rows")
    .select("customer_name,credit_memo_date,item_no,item_descp,quantity,sales_amount,piece_price,salesperson,bp_email")
    .eq("customer_code", customerCode)
    .eq("credit_memo_no", creditMemoNo)
    .order("item_no", { ascending: true });

  if (!isAdmin) query = query.eq("salesperson", session.user.salespersonName);

  const { data, error } = await query;
  if (error) throw new Error("Failed to fetch credit memo items");

  const rows = (data as CreditMemoItemRow[]) ?? [];
  if (rows.length === 0) notFound();

  const customerName = rows.find((r) => r.customer_name)?.customer_name ?? customerCode;
  const creditMemoDate = rows.find((r) => r.credit_memo_date)?.credit_memo_date ?? "-";
  const salesperson = rows.find((r) => r.salesperson)?.salesperson ?? "-";
  const bpEmail = rows.find((r) => r.bp_email)?.bp_email ?? "-";

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-600">Customer</p>
          <h1 className="text-2xl font-semibold">{customerName}</h1>
          <p className="text-sm text-zinc-600">Code: {customerCode}</p>
        </div>
        <Link href={`/dashboard/customers/${encodeURIComponent(customerCode)}`} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50">Back</Link>
      </div>

      <section className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-zinc-700">
        <p><span className="font-medium text-zinc-900">Credit Memo:</span> {creditMemoNo}</p>
        <p><span className="font-medium text-zinc-900">Credit Date:</span> {creditMemoDate}</p>
        <p><span className="font-medium text-zinc-900">Salesperson:</span> {salesperson}</p>
        <p><span className="font-medium text-zinc-900">BP Email:</span> {bpEmail}</p>
      </section>

      <div className="overflow-x-auto rounded-md border border-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Item No</th><th className="px-3 py-2 font-medium">Item Description</th><th className="px-3 py-2 font-medium">Quantity</th><th className="px-3 py-2 font-medium">Sales Amount</th><th className="px-3 py-2 font-medium">Piece Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const quantity = toNumber(row.quantity);
              const salesAmount = toNumber(row.sales_amount);
              const piecePrice = toNumber(row.piece_price);
              if (!row.item_no || !row.item_descp || quantity === null || salesAmount === null || piecePrice === null) return null;
              return <tr key={`${row.item_no}-${index}`} className="border-t border-zinc-200"><td className="px-3 py-2">{row.item_no}</td><td className="px-3 py-2">{row.item_descp}</td><td className="px-3 py-2">{quantity}</td><td className="px-3 py-2">{salesAmount}</td><td className="px-3 py-2">{piecePrice}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
