import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreditRowSalesperson = {
  salesperson: string | null;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const salespersonName = session?.user?.salespersonName;

  if (!salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUser(session?.user?.name)) {
    return Response.json({ salespersons: [salespersonName] });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("credit_rows")
    .select("salesperson")
    .order("salesperson", { ascending: true });

  if (error) {
    console.error("Failed to fetch salespersons", error);
    return Response.json({ error: "Failed to fetch salespersons" }, { status: 500 });
  }

  const uniqueSalespersons = Array.from(
    new Set(
      ((data as CreditRowSalesperson[]) ?? [])
        .map((row) => row.salesperson?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return Response.json({ salespersons: uniqueSalespersons });
}
