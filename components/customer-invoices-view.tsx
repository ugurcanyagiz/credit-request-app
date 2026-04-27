"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ProductCreditRequestModal, type InvoiceItem } from "@/components/product-credit-request-modal";

type InvoiceSummary = {
  invoice_no: string;
  invoice_date: string;
};

type SearchResultItem = InvoiceItem & {
  invoice_no: string;
  invoice_date: string;
};

type CustomerInvoicesViewProps = {
  customerCode: string;
  invoices: InvoiceSummary[];
};

export function CustomerInvoicesView({ customerCode, invoices }: CustomerInvoicesViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResultItem | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  async function runSearch(nextValue: string) {
    const normalizedSearchTerm = nextValue.trim();

    if (normalizedSearchTerm.length < 2) {
      if (debounceTimeoutRef.current !== null) {
        window.clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current);
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsSearching(true);
    setSearchError(null);

    debounceTimeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/customers/${encodeURIComponent(customerCode)}/invoice-item-search?query=${encodeURIComponent(normalizedSearchTerm)}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          setSearchError("Failed to search items.");
          setSearchResults([]);
          return;
        }

        const payload = (await response.json()) as { items?: SearchResultItem[] };
        setSearchResults(payload.items ?? []);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setSearchError("Failed to search items.");
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  }

  const isSearchActive = searchTerm.trim().length >= 2;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Invoices</h2>

      <div className="space-y-1">
        <label htmlFor="customer-invoice-search" className="block text-sm font-medium text-zinc-700">
          Search by Item No or Item Description
        </label>
        <input
          id="customer-invoice-search"
          type="search"
          value={searchTerm}
          onChange={(event) => {
            const nextValue = event.target.value;
            setSearchTerm(nextValue);
            void runSearch(nextValue);
          }}
          placeholder="Minimum 2 characters"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
        />
        <p className="text-xs text-zinc-500">
          Enter an item number or description to find the invoice and open Product Detail & Credit Request directly.
        </p>
      </div>

      {searchError ? <p className="text-sm text-red-600">{searchError}</p> : null}

      {isSearchActive ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-600">
            {isSearching ? "Searching items..." : `${searchResults.length} matching item(s) found.`}
          </p>

          {!isSearching && searchResults.length > 0 ? (
            <ul className="space-y-2">
              {searchResults.map((item, index) => (
                <li key={`${item.invoice_no}-${item.item_no}-${index}`} className="rounded-md border border-zinc-200 p-3 text-sm">
                  <p className="text-zinc-600">Invoice No: {item.invoice_no}</p>
                  <p className="mb-2 text-zinc-600">Invoice Date: {item.invoice_date}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedResult(item)}
                    className="font-medium text-blue-700 underline-offset-2 hover:underline"
                  >
                    {item.item_no}
                  </button>
                  <p className="text-zinc-700">{item.item_descp}</p>
                </li>
              ))}
            </ul>
          ) : null}

          {!isSearching && searchResults.length === 0 ? (
            <p className="text-sm text-zinc-600">No matching items found.</p>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {invoices.map((invoice) => (
            <li key={invoice.invoice_no} className="rounded-md border border-zinc-200 text-sm">
              <Link
                href={`/dashboard/customers/${encodeURIComponent(customerCode)}/invoices/${encodeURIComponent(invoice.invoice_no)}`}
                className="block px-3 py-2 transition-colors hover:bg-zinc-50"
              >
                <p className="font-medium">Invoice No: {invoice.invoice_no}</p>
                <p className="text-zinc-600">Invoice Date: {invoice.invoice_date}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {selectedResult ? (
        <ProductCreditRequestModal
          item={selectedResult}
          customerCode={customerCode}
          invoiceNo={selectedResult.invoice_no}
          onClose={() => setSelectedResult(null)}
        />
      ) : null}
    </section>
  );
}
