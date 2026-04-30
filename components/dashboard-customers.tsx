"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

type Customer = {
  customer_code: string;
  customer_name: string;
};

type DashboardCustomersProps = {
  isAdmin: boolean;
  defaultSalesperson: string;
};

export function DashboardCustomers({ isAdmin, defaultSalesperson }: DashboardCustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salespersons, setSalespersons] = useState<string[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>(isAdmin ? "" : defaultSalesperson);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(!isAdmin);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let isMounted = true;

    async function loadSalespersons() {
      try {
        const response = await fetch("/api/salespersons", { cache: "no-store" });
        if (!response.ok) {
          if (isMounted) {
            setError("Failed to load salespersons.");
          }
          return;
        }

        const payload = (await response.json()) as { salespersons?: string[] };
        if (isMounted) {
          setSalespersons(payload.salespersons ?? []);
        }
      } catch {
        if (isMounted) {
          setError("Failed to load salespersons.");
        }
      }
    }

    void loadSalespersons();

    return () => {
      isMounted = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && !selectedSalesperson) {
      return;
    }

    let isMounted = true;

    async function loadCustomers() {
      try {
        const params = new URLSearchParams();
        if (selectedSalesperson) {
          params.set("salesperson", selectedSalesperson);
        }

        const response = await fetch(`/api/customers?${params.toString()}`, {
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
  }, [isAdmin, selectedSalesperson]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();

    if (!normalizedSearchTerm) {
      return customers;
    }

    return customers.filter((customer) => {
      const customerCode = customer.customer_code.toLocaleLowerCase();
      const customerName = customer.customer_name.toLocaleLowerCase();

      return customerCode.includes(normalizedSearchTerm) || customerName.includes(normalizedSearchTerm);
    });
  }, [customers, searchTerm]);

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

      {isAdmin ? (
        <div>
          <label htmlFor="salesperson-select" className="mb-1 block text-sm font-medium text-zinc-700">
            Salesperson seçin
          </label>
          <select
            id="salesperson-select"
            value={selectedSalesperson}
            onChange={(event) => setSelectedSalesperson(event.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Önce bir salesperson seçin</option>
            {salespersons.map((salesperson) => (
              <option key={salesperson} value={salesperson}>
                {salesperson}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div>
        <label htmlFor="customer-search" className="mb-1 block text-sm font-medium text-zinc-700">
          Search customer
        </label>
        <input
          id="customer-search"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by customer code or name..."
          disabled={isLoading || (isAdmin && !selectedSalesperson)}
          aria-busy={isLoading}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
        />
      </div>

      {isAdmin && !selectedSalesperson ? (
        <p className="text-sm text-zinc-600">Müşteri listesini görmek için bir salesperson seçin.</p>
      ) : isLoading ? (
        <p className="text-xs tracking-wide text-zinc-500">Loading customers…</p>
      ) : (
        <ul className="space-y-2">
          {filteredCustomers.map((customer) => (
            <li key={customer.customer_code} className="rounded-md border border-zinc-200 text-sm">
              <Link
                href={`/dashboard/customers/${encodeURIComponent(customer.customer_code)}${
                  isAdmin && selectedSalesperson
                    ? `?salesperson=${encodeURIComponent(selectedSalesperson)}`
                    : ""
                }`}
                className="block px-3 py-2 transition-colors hover:bg-zinc-50"
              >
                <p className="font-medium">{customer.customer_code}</p>
                <p className="text-zinc-600">{customer.customer_name}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
