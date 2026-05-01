import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { InvoiceItemsTable } from "@/components/invoice-items-table";

type CreditMemoItemRow = {
  customer_name: string | null;
  credit_memo_date: string | null;
  item_no: string | null;
  item_descp: string | null;
  quantity: number | string | null;
  sales_amount: number | string | null;
  sales_batch_number: string | null;
  sales_lot_no: string | null;
  batch_expiration_date: string | null;
  piece_price: number | string | null;
};

type CreditMemoItemsPageProps = {
  params: Promise<{ customerCode: string; creditMemoNo: string }>;
};

function toNumber(value: number | string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export default async function CreditMemoItemsPage({ params }: CreditMemoItemsPageProps) {
  const session = await getServerSession(authOptions);
  const isAdmin = isAdminUser(session?.user?.name);

  if (!session?.user?.salespersonName) {
    redirect("/");
  }

  const { customerCode: rawCustomerCode, creditMemoNo: rawCreditMemoNo } = await params;
  const customerCode = decodeURIComponent(rawCustomerCode);
  const creditMemoNo = decodeURIComponent(rawCreditMemoNo);

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from("credit_memo_rows")
    .select(
      "customer_name,credit_memo_date,item_no,item_descp,quantity,sales_amount,sales_batch_number,sales_lot_no,batch_expiration_date,piece_price",
    )
    .eq("customer_code", customerCode)
    .eq("credit_memo_no", creditMemoNo)
    .order("item_no", { ascending: true });

  if (!isAdmin) {
    query = query.eq("salesperson", session.user.salespersonName);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch credit memo items", error);
    throw new Error("Failed to fetch credit memo items");
  }

  const rows = (data as CreditMemoItemRow[]) ?? [];
  let customerName: string | null = null;
  let creditMemoDate: string | null = null;
  const items: Array<{
    item_no: string;
    item_descp: string;
    quantity: number;
    sales_amount: number;
    sales_batch_number: string;
    sales_lot_no: string;
    batch_expiration_date: string;
    piece_price: number;
  }> = [];

  for (const row of rows) {
    if (!customerName && row.customer_name) customerName = row.customer_name;
    if (!creditMemoDate && row.credit_memo_date) creditMemoDate = row.credit_memo_date;

    const quantity = toNumber(row.quantity);
    const salesAmount = toNumber(row.sales_amount);
    const piecePrice = toNumber(row.piece_price);

    if (
      row.item_no &&
      row.item_descp &&
      quantity !== null &&
      salesAmount !== null &&
      row.sales_batch_number &&
      row.sales_lot_no &&
      row.batch_expiration_date &&
      piecePrice !== null
    ) {
      items.push({
        item_no: row.item_no,
        item_descp: row.item_descp,
        quantity,
        sales_amount: salesAmount,
        sales_batch_number: row.sales_batch_number,
        sales_lot_no: row.sales_lot_no,
        batch_expiration_date: row.batch_expiration_date,
        piece_price: piecePrice,
      });
    }
  }

  if (items.length === 0) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-600">Customer</p>
          <h1 className="text-2xl font-semibold">{customerName ?? customerCode}</h1>
          <p className="text-sm text-zinc-600">Code: {customerCode}</p>
          <p className="text-sm text-amber-700">Credit Memo: {creditMemoNo}</p>
          <p className="text-sm text-amber-700">Credit Date: {creditMemoDate ?? "-"}</p>
        </div>
        <Link
          href={`/dashboard/customers/${encodeURIComponent(customerCode)}`}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Credit Memo Items</h2>
        <InvoiceItemsTable items={items} customerCode={customerCode} invoiceNo={creditMemoNo} />
      </section>
    </main>
  );
}
