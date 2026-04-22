import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreditRowCustomer = {
  customer_code: string | null;
  customer_name: string | null;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const salespersonName = session?.user?.salespersonName;

  if (!salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("credit_rows")
    .select("customer_code,customer_name")
    .eq("salesperson", salespersonName)
    .order("customer_code", { ascending: true });

  if (error) {
    console.error("Failed to fetch customers", error);
    return Response.json({ error: "Failed to fetch customers" }, { status: 500 });
  }

  const uniqueCustomers = Array.from(
    new Map(
      (data as CreditRowCustomer[])
        .filter((row) => row.customer_code && row.customer_name)
        .map((row) => [row.customer_code, row]),
    ).values(),
  );

  return Response.json({ customers: uniqueCustomers });
}
