"use client";

import { useState } from "react";

type CreditType = "case" | "piece";

type NotFromRecentInvoicesNoteProps = {
  customerCode: string;
};

type ItemLookupOption = {
  item_no: string;
  item_descp: string;
};

export function NotFromRecentInvoicesNote({ customerCode }: NotFromRecentInvoicesNoteProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [itemNo, setItemNo] = useState("");
  const [description, setDescription] = useState("");
  const [creditType, setCreditType] = useState<CreditType>("case");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemOptions, setItemOptions] = useState<ItemLookupOption[]>([]);
  const [isItemLookupLoading, setIsItemLookupLoading] = useState(false);
  const [showItemOptions, setShowItemOptions] = useState(false);

  async function loadItemOptions(searchValue: string) {
    const normalizedSearch = searchValue.trim();
    if (normalizedSearch.length < 2) {
      setItemOptions([]);
      setShowItemOptions(false);
      return;
    }

    setIsItemLookupLoading(true);
    const response = await fetch(
      `/api/customers/${encodeURIComponent(customerCode)}/item-lookup?query=${encodeURIComponent(normalizedSearch)}`,
    );
    setIsItemLookupLoading(false);

    if (!response.ok) {
      setItemOptions([]);
      setShowItemOptions(false);
      return;
    }

    const payload = (await response.json().catch(() => null)) as { items?: ItemLookupOption[] } | null;
    const options = payload?.items ?? [];
    setItemOptions(options);
    setShowItemOptions(options.length > 0);
  }

  function applyItemOption(option: ItemLookupOption) {
    setItemNo(option.item_no);
    setDescription(option.item_descp);
    setItemOptions([]);
    setShowItemOptions(false);
  }

  function openModal() {
    setSubmitError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
  }

  async function addNoteToCart() {
    const trimmedReason = reason.trim();

    if (trimmedReason.length === 0) {
      setSubmitError("Reason is required.");
      return;
    }

    const parsedAmount = Number(amount);
    const creditAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;

    const trimmedDescription = description.trim();
    const itemDescription =
      trimmedDescription.length > 0
        ? `${trimmedDescription} | Reason: ${trimmedReason}`
        : `Reason: ${trimmedReason}`;

    setIsSubmitting(true);
    setSubmitError(null);

    const response = await fetch("/api/cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_code: customerCode,
        invoice_no: invoiceNo.trim() || "NOT_FROM_RECENT_INVOICES",
        item_no: itemNo.trim() || "NOT_FROM_RECENT_INVOICES",
        item_descp: itemDescription,
        quantity: 0,
        sales_amount: 0,
        sales_batch_number: null,
        sales_lot_no: null,
        batch_expiration_date: null,
        piece_price: 0,
        credit_type: creditType,
        credit_amount: creditAmount,
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setSubmitError(payload?.error ?? "Failed to add note to cart");
      return;
    }

    setIsModalOpen(false);
    setInvoiceNo("");
    setItemNo("");
    setDescription("");
    setCreditType("case");
    setAmount("");
    setReason("");
    setItemOptions([]);
    setShowItemOptions(false);
    window.dispatchEvent(new Event("cart-updated"));
  }

  return (
    <>
      <div className="mt-5 rounded-md border border-zinc-200 p-4">
        <h3 className="text-base font-semibold">Not from recent invoices</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Please add credit note if the item is not from the invoices above
        </p>

        <div className="mt-3">
          <button
            type="button"
            onClick={openModal}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
          >
            Add
          </button>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold">Add Credit Note</h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-zinc-700">Invoice No</span>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(event) => setInvoiceNo(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700">Item No</span>
                <div className="relative">
                  <input
                    type="text"
                    value={itemNo}
                    onChange={(event) => {
                      const value = event.target.value;
                      setItemNo(value);
                      void loadItemOptions(value);
                    }}
                    onFocus={() => setShowItemOptions(itemOptions.length > 0)}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowItemOptions(false);
                      }, 120);
                    }}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                  {showItemOptions ? (
                    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-zinc-300 bg-white py-1 shadow-lg">
                      {itemOptions.map((option) => (
                        <li key={option.item_no}>
                          <button
                            type="button"
                            onClick={() => applyItemOption(option)}
                            className="block w-full px-3 py-2 text-left hover:bg-zinc-50"
                          >
                            <p className="font-medium text-zinc-800">{option.item_no}</p>
                            <p className="text-xs text-zinc-600">{option.item_descp}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {isItemLookupLoading ? <p className="mt-1 text-xs text-zinc-500">Searching item numbers…</p> : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700">Description</span>
                <input
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700">Type</span>
                <select
                  value={creditType}
                  onChange={(event) => setCreditType(event.target.value as CreditType)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                >
                  <option value="case">case</option>
                  <option value="piece">piece</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700">Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700">Reason*</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  rows={3}
                />
              </label>
            </div>

            {submitError ? <p className="mt-3 text-sm text-red-600">{submitError}</p> : null}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void addNoteToCart()}
                disabled={isSubmitting}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
