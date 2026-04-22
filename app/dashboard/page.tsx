import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { DashboardCustomers } from "@/components/dashboard-customers";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    redirect("/");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Signed in as salesperson: {session.user.salespersonName}
      </p>
      <DashboardCustomers />
    </main>
  );
}
