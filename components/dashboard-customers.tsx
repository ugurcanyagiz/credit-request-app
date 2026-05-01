"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

type Customer = {
  customer_code: string;
  customer_name: string;
};

export function DashboardCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCustomers() {
      try {
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
      } catch {
        if (isMounted) {
          setError("Failed to load customers.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCustomers();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();

    if (!normalizedSearchTerm) {
      return customers;
    }

    return customers.filter((customer) => {
      const customerCode = customer.customer_code.toLocaleLowerCase();
      const customerName = customer.customer_name.toLocaleLowerCase();

      return (
        customerCode.includes(normalizedSearchTerm) ||
        customerName.includes(normalizedSearchTerm)
      );
    });
  }, [customers, searchTerm]);

  return (
    <section className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Customers</h2>
          <p className="text-xs text-zinc-500">Browse invoices by customer.</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        >
          Sign out
        </button>
      </div>


      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div>
        <label
          htmlFor="customer-search"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          Search customer
        </label>
        <input
          id="customer-search"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by customer code or name..."
          disabled={isLoading}
          aria-busy={isLoading}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
        />
      </div>

      {isLoading ? (
        <div aria-live="polite" className="space-y-2">
          <p className="text-xs tracking-wide text-zinc-500">Loading customers…</p>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`customer-loading-${index}`}
              className="rounded-md border border-zinc-200 px-3 py-2"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredCustomers.map((customer) => (
            <li
              key={customer.customer_code}
              className="rounded-md border border-zinc-200 text-sm"
            >
              <Link
                href={`/dashboard/customers/${encodeURIComponent(customer.customer_code)}`}
                className="block px-3 py-2 transition-colors hover:bg-zinc-50"
              >
                <p className="font-medium">{customer.customer_code}</p>
                <p className="text-zinc-600">{customer.customer_name}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && !error && filteredCustomers.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No customers found for this search.
        </p>
      ) : null}
    </section>
  );
}
