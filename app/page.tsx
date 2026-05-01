import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { LoginForm } from "@/components/login-form";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Sign in</h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-300">
          Use your existing app user credentials.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
