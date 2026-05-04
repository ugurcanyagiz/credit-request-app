"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { signOut } from "next-auth/react";

type Customer = {
  customer_code: string;
  customer_name: string;
};

type DashboardCustomersProps = {
  initialCustomers: Customer[];
};

export function DashboardCustomers({ initialCustomers }: DashboardCustomersProps) {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [searchTerm, setSearchTerm] = useState("");

  function normalizeSearchValue(value: string) {
    return value
      .trim()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("en-US");
  }

  const filteredCustomers = useMemo(() => {
    const normalizedSearchTerm = normalizeSearchValue(searchTerm);

    if (!normalizedSearchTerm) {
      return customers;
    }

    return customers.filter((customer) => {
      const customerCode = normalizeSearchValue(customer.customer_code);
      const customerName = normalizeSearchValue(customer.customer_name);

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
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Browse invoices by customer.</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm"
        >
          Sign out
        </button>
      </div>

      <div>
        <label
          htmlFor="customer-search"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          Search customer
        </label>
        <input
          id="customer-search"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by customer code or name..."
          aria-busy={false}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-500 dark:focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700/60"
        />
      </div>

      <ul className="space-y-2">
        {filteredCustomers.map((customer) => (
          <li
            key={customer.customer_code}
            className="rounded-md border border-zinc-200 dark:border-zinc-800 text-sm"
          >
            <Link
              href={`/dashboard/customers/${encodeURIComponent(customer.customer_code)}`}
              className="block px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-900/40"
            >
              <p className="font-medium">{customer.customer_code}</p>
              <p className="text-zinc-600 dark:text-zinc-300">{customer.customer_name}</p>
            </Link>
          </li>
        ))}
      </ul>

      {filteredCustomers.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          No customers found for this search.
        </p>
      ) : null}
    </section>
  );
}
