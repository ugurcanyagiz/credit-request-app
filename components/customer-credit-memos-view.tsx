"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CreditMemoSummary = {
  credit_memo_no: string;
  credit_memo_date: string | null;
};

type CustomerCreditMemosViewProps = {
  customerCode: string;
};

function formatCreditMemoDate(value: string | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function CustomerCreditMemosView({ customerCode }: CustomerCreditMemosViewProps) {
  const [creditMemos, setCreditMemos] = useState<CreditMemoSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/customers/${encodeURIComponent(customerCode)}/credit-memos`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load credit memos");
        }
        const payload = (await response.json()) as { creditMemos?: CreditMemoSummary[] };
        setCreditMemos(payload.creditMemos ?? []);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setLoadError("Failed to load credit memos.");
          setCreditMemos([]);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [customerCode]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Credit Memos</h2>

      {isLoading ? <p className="text-sm text-zinc-500">Loading credit memos...</p> : null}

      {!isLoading && loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}

      {!isLoading && !loadError && creditMemos.length > 0 ? (
        <ul className="space-y-2">
          {creditMemos.map((memo) => (
            <li key={memo.credit_memo_no} className="rounded-md border border-zinc-200 text-sm">
              <Link
                href={`/dashboard/customers/${encodeURIComponent(customerCode)}/credit-memos/${encodeURIComponent(memo.credit_memo_no)}`}
                className="block px-3 py-2 transition-colors hover:bg-zinc-50"
              >
                <p className="font-medium">Credit Memo: {memo.credit_memo_no}</p>
                <p className="text-zinc-600">Credit Date: {formatCreditMemoDate(memo.credit_memo_date)}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        !isLoading && !loadError ? (
          <p className="text-sm text-zinc-500">No credit memos found for this customer.</p>
        ) : null
      )}
    </section>
  );
}
