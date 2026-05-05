"use client";

import { useMemo, useState } from "react";

import { ProductCreditRequestModal, type InvoiceItem } from "@/components/product-credit-request-modal";

type InvoiceItemsTableProps = {
  items: InvoiceItem[];
  customerCode: string;
  invoiceNo: string;
  allowItemSelection?: boolean;
};

export function InvoiceItemsTable({ items, customerCode, invoiceNo, allowItemSelection = true }: InvoiceItemsTableProps) {
  const [selectedItem, setSelectedItem] = useState<InvoiceItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();
  const filteredItems = useMemo(() => {
    if (normalizedSearchTerm.length === 0) {
      return items;
    }

    return items.filter((item) => {
      const itemNo = item.item_no.toLocaleLowerCase();
      const itemDescription = item.item_descp.toLocaleLowerCase();
      return itemNo.includes(normalizedSearchTerm) || itemDescription.includes(normalizedSearchTerm);
    });
  }, [items, normalizedSearchTerm]);

  return (
    <>
      <div className="mb-3 space-y-1">
        <label htmlFor="invoice-item-search" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Search Items
        </label>
        <input
          id="invoice-item-search"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Filter by Item No or Item Description"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-zinc-500 dark:focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Item No</th>
              <th className="px-3 py-2 font-medium">Item Description</th>
              <th className="px-3 py-2 font-medium">Quantity</th>
              <th className="px-3 py-2 font-medium">Sales Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => (
                <tr key={`${item.item_no}-${index}`} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">
                    {allowItemSelection ? (
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="font-medium text-blue-700 underline-offset-2 hover:underline"
                      >
                        {item.item_no}
                      </button>
                    ) : (
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.item_no}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{item.item_descp}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{item.sales_amount}</td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td colSpan={4} className="px-3 py-4 text-center text-zinc-500 dark:text-zinc-400">
                  No items match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {allowItemSelection && selectedItem ? (
        <ProductCreditRequestModal
          item={selectedItem}
          customerCode={customerCode}
          invoiceNo={invoiceNo}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </>
  );
}
