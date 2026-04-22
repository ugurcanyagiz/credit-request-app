"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

type Customer = {
  customer_code: string;
  customer_name: string;
};

export function DashboardCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCustomers() {
      const response = await fetch("/api/customers", {
        cache: "no-store",
      });

      if (!response.ok) {
        if (isMounted) {
          setError("Failed to load customers.");
        }
        return;
      }

      const payload = (await response.json()) as { customers?: Customer[] };

      if (isMounted) {
        setCustomers(payload.customers ?? []);
      }
    }

    void loadCustomers();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Customers</h2>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        >
          Sign out
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ul className="space-y-2">
        {customers.map((customer) => (
          <li
            key={customer.customer_code}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
          >
            <p className="font-medium">{customer.customer_code}</p>
            <p className="text-zinc-600">{customer.customer_name}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
