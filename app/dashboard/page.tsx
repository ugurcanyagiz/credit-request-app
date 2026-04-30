import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { DashboardCustomers } from "@/components/dashboard-customers";
import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    redirect("/");
  }

  const isAdmin = isAdminUser(session.user.name);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Turkana Food INC.</h1>
      <p className="mt-2 text-sm text-zinc-600">Credit Request Form Creator</p>
      <p className="group mt-1 text-sm text-zinc-600 transition-opacity duration-300 hover:opacity-0">
        {isAdmin ? "Hoşgeldiniz adminim" : `Welcome, ${session.user.salespersonName}`}
      </p>
      <DashboardCustomers
        isAdmin={isAdmin}
        defaultSalesperson={session.user.salespersonName}
      />
    </main>
  );
}
