import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NotFromRecentInvoicesNote } from "@/components/not-from-recent-invoices-note";
import { CustomerInvoicesView } from "@/components/customer-invoices-view";
import { CustomerCreditMemosView } from "@/components/customer-credit-memos-view";

type CreditRowInvoice = {
  customer_name: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  credit_memo_no: string | null;
  credit_memo_date: string | null;
};

type CreditMemoSummaryRow = {
  credit_memo_no: string | null;
  credit_memo_date: string | null;
};

type CustomerCreditMemoSummaryRow = {
  credit_memo_no: string | null;
  credit_memo_date: string | null;
};

type CreditMemoSummary = {
  customer_name: string | null;
  credit_memo_no: string | null;
  credit_memo_date: string | null;
};

type CustomerInvoicesPageProps = {
  params: Promise<{ customerCode: string }>;
};

export default async function CustomerInvoicesPage({ params }: CustomerInvoicesPageProps) {
  const session = await getServerSession(authOptions);
  const isAdmin = isAdminUser(session?.user?.name);

  if (!session?.user?.salespersonName) {
    redirect("/");
  }

  const { customerCode: rawCustomerCode } = await params;
  const customerCode = decodeURIComponent(rawCustomerCode);

  const supabaseAdmin = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  let customerName: string | null = null;
  const invoicesByNo = new Map<string, { invoice_no: string; invoice_date: string }>();
  const creditMemosByNo = new Map<string, { credit_memo_no: string; credit_memo_date: string }>();

  while (hasMore) {
    const to = from + pageSize - 1;
    let query = supabaseAdmin
      .from("credit_rows")
      .select("customer_name,invoice_no,invoice_date,credit_memo_no,credit_memo_date")
      .eq("customer_code", customerCode)
      .order("invoice_no", { ascending: true })
      .range(from, to);
    if (!isAdmin) {
      query = query.eq("salesperson", session.user.salespersonName);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch customer invoices", error);
      throw new Error("Failed to fetch customer invoices");
    }

    const rows = (data as CreditRowInvoice[]) ?? [];

    for (const row of rows) {
      if (!customerName && row.customer_name) {
        customerName = row.customer_name;
      }

      if (row.invoice_no && row.invoice_date && !invoicesByNo.has(row.invoice_no)) {
        invoicesByNo.set(row.invoice_no, {
          invoice_no: row.invoice_no,
          invoice_date: row.invoice_date,
        });
      }

    }

    hasMore = rows.length === pageSize;
    from += pageSize;
  }

  from = 0;
  hasMore = true;

  while (hasMore) {
    const to = from + pageSize - 1;
    let creditMemoQuery = supabaseAdmin
      .from("credit_memo_rows")
      .select("credit_memo_no,credit_memo_date")
      .eq("customer_code", customerCode)
      .order("credit_memo_no", { ascending: false })
      .range(from, to);

    if (!isAdmin) {
      creditMemoQuery = creditMemoQuery.eq("salesperson", session.user.salespersonName);
    }

    const { data: creditMemoData, error: creditMemoError } = await creditMemoQuery;

    if (creditMemoError) {
      console.error("Failed to fetch customer credit memos", creditMemoError);
      throw new Error("Failed to fetch customer credit memos");
    }

    const creditMemoRows = (creditMemoData as CustomerCreditMemoSummaryRow[]) ?? [];

    for (const row of creditMemoRows) {
      if (row.credit_memo_no && row.credit_memo_date && !creditMemosByNo.has(row.credit_memo_no)) {
        creditMemosByNo.set(row.credit_memo_no, {
          credit_memo_no: row.credit_memo_no,
          credit_memo_date: row.credit_memo_date,
        });
      }
    }

    hasMore = creditMemoRows.length === pageSize;
    from += pageSize;
  }

  if (!customerName && invoicesByNo.size === 0 && creditMemosByNo.size === 0) {
    notFound();
  }

  const invoices = Array.from(invoicesByNo.values());
  from = 0;
  hasMore = true;

  while (hasMore) {
    const to = from + pageSize - 1;
    let query = supabaseAdmin
      .from("credit_memo_rows")
      .select("customer_name,credit_memo_no,credit_memo_date")
      .eq("customer_code", customerCode)
      .order("credit_memo_no", { ascending: false })
      .range(from, to);

    if (!isAdmin) {
      query = query.eq("salesperson", session.user.salespersonName);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch customer credit memos", error);
      throw new Error("Failed to fetch customer credit memos");
    }

    const rows = (data as CreditMemoSummary[]) ?? [];

    for (const row of rows) {
      if (!customerName && row.customer_name) {
        customerName = row.customer_name;
      }

      if (row.credit_memo_no && row.credit_memo_date && !creditMemosByNo.has(row.credit_memo_no)) {
        creditMemosByNo.set(row.credit_memo_no, {
          credit_memo_no: row.credit_memo_no,
          credit_memo_date: row.credit_memo_date,
        });
      }
    }

    hasMore = rows.length === pageSize;
    from += pageSize;
  }


  const creditMemos = Array.from(creditMemosByNo.values());

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-600">Customer</p>
          <h1 className="text-2xl font-semibold">{customerName ?? customerCode}</h1>
          <p className="text-sm text-zinc-600">Code: {customerCode}</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <CustomerInvoicesView customerCode={customerCode} invoices={invoices} creditMemos={creditMemos} />

      <CustomerCreditMemosView customerCode={customerCode} creditMemos={creditMemos} />

      <NotFromRecentInvoicesNote customerCode={customerCode} />
    </main>
  );
}
