"use client";

import { signOut } from "next-auth/react";

export function AdminLogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-red-50 hover:text-red-700 hover:ring-red-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-red-950/30 dark:hover:text-red-300 dark:hover:ring-red-900"
    >
      Logout
    </button>
  );
}
