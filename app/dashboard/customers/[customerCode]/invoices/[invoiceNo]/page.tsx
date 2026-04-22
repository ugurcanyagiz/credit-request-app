import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type InvoiceItemRow = {
  customer_name: string | null;
  invoice_date: string | null;
  item_no: string | null;
  item_descp: string | null;
  quantity: number | string | null;
  sales_amount: number | string | null;
};

type InvoiceItemsPageProps = {
  params: Promise<{ customerCode: string; invoiceNo: string }>;
};

export default async function InvoiceItemsPage({ params }: InvoiceItemsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    redirect("/");
  }

  const { customerCode: rawCustomerCode, invoiceNo: rawInvoiceNo } = await params;
  const customerCode = decodeURIComponent(rawCustomerCode);
  const invoiceNo = decodeURIComponent(rawInvoiceNo);

  const supabaseAdmin = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  let customerName: string | null = null;
  let invoiceDate: string | null = null;
  const items: Array<{
    item_no: string;
    item_descp: string;
    quantity: number;
    sales_amount: number;
  }> = [];

  function toNumber(value: number | string | null): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  while (hasMore) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseAdmin
      .from("credit_rows")
      .select("customer_name,invoice_date,item_no,item_descp,quantity,sales_amount")
      .eq("salesperson", session.user.salespersonName)
      .eq("customer_code", customerCode)
      .eq("invoice_no", invoiceNo)
      .order("item_no", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("Failed to fetch invoice items", error);
      throw new Error("Failed to fetch invoice items");
    }

    const rows = (data as InvoiceItemRow[]) ?? [];

    for (const row of rows) {
      if (!customerName && row.customer_name) {
        customerName = row.customer_name;
      }

      if (!invoiceDate && row.invoice_date) {
        invoiceDate = row.invoice_date;
      }

      const quantity = toNumber(row.quantity);
      const salesAmount = toNumber(row.sales_amount);

      if (row.item_no && row.item_descp && quantity !== null && salesAmount !== null) {
        items.push({
          item_no: row.item_no,
          item_descp: row.item_descp,
          quantity,
          sales_amount: salesAmount,
        });
      }
    }

    hasMore = rows.length === pageSize;
    from += pageSize;
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
          <p className="text-sm text-zinc-600">Invoice No: {invoiceNo}</p>
          <p className="text-sm text-zinc-600">Invoice Date: {invoiceDate ?? "-"}</p>
        </div>
        <Link
          href={`/dashboard/customers/${encodeURIComponent(customerCode)}`}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Invoice Items</h2>

        <div className="overflow-x-auto rounded-md border border-zinc-200">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Item No</th>
                <th className="px-3 py-2 font-medium">Item Description</th>
                <th className="px-3 py-2 font-medium">Quantity</th>
                <th className="px-3 py-2 font-medium">Sales Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.item_no}-${index}`} className="border-t border-zinc-200">
                  <td className="px-3 py-2">{item.item_no}</td>
                  <td className="px-3 py-2">{item.item_descp}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{item.sales_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
