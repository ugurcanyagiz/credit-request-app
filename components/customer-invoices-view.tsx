"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ProductCreditRequestModal, type InvoiceItem } from "@/components/product-credit-request-modal";
import { NotFromRecentInvoicesNote } from "@/components/not-from-recent-invoices-note";

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
  const [activeTab, setActiveTab] = useState<"invoices" | "credits">("invoices");
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
  const invoiceRows = invoices.filter((invoice) => !invoice.invoice_no.startsWith("CM-"));
  const creditRows = invoices.filter((invoice) => invoice.invoice_no.startsWith("CM-"));

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "invoices"
              ? "border-zinc-800 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
          }`}
        >
          Invoices
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("credits")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "credits"
              ? "border-zinc-800 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
          }`}
        >
          Credits
        </button>
      </div>

      {activeTab === "invoices" ? (
        <div className="space-y-1">
          <label htmlFor="customer-invoice-search" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
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
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-500 dark:focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700/60"
          />
        </div>
      ) : null}

      {searchError ? <p className="text-sm text-red-600">{searchError}</p> : null}

      {activeTab === "invoices" && isSearchActive ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {isSearching ? "Searching items..." : `${searchResults.length} matching item(s) found.`}
          </p>

          {!isSearching && searchResults.length > 0 ? (
            <ul className="space-y-2">
              {searchResults.map((item, index) => (
                <li key={`${item.invoice_no}-${item.item_no}-${index}`} className="rounded-md border border-zinc-200 dark:border-zinc-800 text-sm">
                  <button
                    type="button"
                    onClick={() => setSelectedResult(item)}
                    className="block w-full px-3 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-900/40"
                  >
                    <p className="text-zinc-600 dark:text-zinc-300">Invoice No: {item.invoice_no}</p>
                    <p className="mb-2 text-zinc-600 dark:text-zinc-300">Invoice Date: {item.invoice_date}</p>
                    <p className="mb-2 text-zinc-600 dark:text-zinc-300">Lot Number: {item.sales_lot_no}</p>
                    <p className="font-medium text-blue-700">{item.item_no}</p>
                    <p className="text-zinc-700 dark:text-zinc-200">{item.item_descp}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {!isSearching && searchResults.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">No matching items found.</p>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="space-y-2">
          {(activeTab === "invoices" ? invoiceRows : creditRows).map((invoice) => (
            <li key={invoice.invoice_no} className="rounded-md border border-zinc-200 dark:border-zinc-800 text-sm">
              <Link
                href={`/dashboard/customers/${encodeURIComponent(customerCode)}/invoices/${encodeURIComponent(invoice.invoice_no)}`}
                className="block px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-900/40"
              >
                <p className="font-medium">{activeTab === "invoices" ? "Invoice No" : "Credit No"}: {invoice.invoice_no}</p>
                <p className="text-zinc-600 dark:text-zinc-300">{activeTab === "invoices" ? "Invoice Date" : "Credit Date"}: {invoice.invoice_date}</p>
              </Link>
            </li>
          ))}
          </ul>

        </>
      )}

      {selectedResult ? (
        <ProductCreditRequestModal
          item={selectedResult}
          customerCode={customerCode}
          invoiceNo={selectedResult.invoice_no}
          onClose={() => setSelectedResult(null)}
        />
      ) : null}

      {activeTab === "invoices" ? <NotFromRecentInvoicesNote customerCode={customerCode} /> : null}
    </section>
  );
}
