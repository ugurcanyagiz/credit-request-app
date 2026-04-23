import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreditRowItem = {
  item_no: string | null;
  item_descp: string | null;
};

export async function GET(request: Request, context: RouteContext<"/api/customers/[customerCode]/item-lookup">) {
  const session = await getServerSession(authOptions);
  const salespersonName = session?.user?.salespersonName;

  if (!salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { customerCode: rawCustomerCode } = await context.params;
  const customerCode = decodeURIComponent(rawCustomerCode);
  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";

  if (query.length < 2) {
    return Response.json({ items: [] });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("credit_rows")
    .select("item_no,item_descp")
    .eq("salesperson", salespersonName)
    .eq("customer_code", customerCode)
    .ilike("item_no", `%${query}%`)
    .limit(8);

  if (error) {
    console.error("Failed to fetch item lookup data", error);
    return Response.json({ error: "Failed to fetch item suggestions" }, { status: 500 });
  }

  const uniqueItemsByNo = new Map<string, string>();
  for (const row of (data as CreditRowItem[]) ?? []) {
    if (!row.item_no || !row.item_descp || uniqueItemsByNo.has(row.item_no)) {
      continue;
    }

    uniqueItemsByNo.set(row.item_no, row.item_descp);
  }

  const items = Array.from(uniqueItemsByNo.entries()).map(([item_no, item_descp]) => ({
    item_no,
    item_descp,
  }));

  return Response.json({ items });
}
