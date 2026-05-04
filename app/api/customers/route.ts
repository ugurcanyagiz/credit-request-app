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
  let query = supabaseAdmin
    .from("credit_customer_list")
    .select("customer_code,customer_name")
    .order("customer_code", { ascending: true });

  if (!isAdmin) {
    query = query.eq("salesperson", salespersonName);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch customers", error);
    return Response.json({ error: "Failed to fetch customers" }, { status: 500 });
  }

  const uniqueCustomers = ((data as CreditRowCustomer[]) ?? []).filter(
    (row): row is { customer_code: string; customer_name: string } =>
      Boolean(row.customer_code) && Boolean(row.customer_name),
  );

  return Response.json({ customers: uniqueCustomers });
}
