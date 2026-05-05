import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import creditAppLogo from "@/components/creditapp.png";
import { LoginForm } from "@/components/login-form";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-100 via-white to-zinc-100 px-4 py-8 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_top,rgba(24,24,27,0.1),transparent_35%)] dark:[background:radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%)]" />

      <section className="relative w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white/90 p-8 shadow-xl shadow-zinc-300/20 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-black/20">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src={creditAppLogo}
            alt="Credit App"
            priority
            className="mb-4 h-14 w-auto"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Continue with your existing app credentials.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
