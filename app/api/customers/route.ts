import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreditRowCustomer = {
  customer_code: string | null;
  customer_name: string | null;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const salespersonName = session?.user?.salespersonName;
  const isAdmin = isAdminUser(session?.user?.name);

  if (!salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  const customersByCode = new Map<string, CreditRowCustomer>();
  let hasMore = true;

  while (hasMore) {
    const to = from + pageSize - 1;
    let query = supabaseAdmin
      .from("credit_rows")
      .select("customer_code,customer_name")
      .order("customer_code", { ascending: true })
      .range(from, to);
    if (!isAdmin) {
      query = query.eq("salesperson", salespersonName);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch customers", error);
      return Response.json({ error: "Failed to fetch customers" }, { status: 500 });
    }

    const rows = (data as CreditRowCustomer[]) ?? [];

    for (const row of rows) {
      if (row.customer_code && row.customer_name && !customersByCode.has(row.customer_code)) {
        customersByCode.set(row.customer_code, row);
      }
    }

    hasMore = rows.length === pageSize;
    from += pageSize;
  }

  const uniqueCustomers = Array.from(customersByCode.values());

  return Response.json({ customers: uniqueCustomers });
}
