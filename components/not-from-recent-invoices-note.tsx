"use client";

import { useEffect, useRef, useState } from "react";

type CreditType = "case" | "piece";

type NotFromRecentInvoicesNoteProps = {
  customerCode: string;
};

type ItemLookupOption = {
  item_no: string;
  item_descp: string;
};

type LookupSearchBy = "item_no" | "item_descp";

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
  const [activeLookupField, setActiveLookupField] = useState<LookupSearchBy | null>(null);
  const lookupAbortControllerRef = useRef<AbortController | null>(null);
  const lookupDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (lookupAbortControllerRef.current) {
        lookupAbortControllerRef.current.abort();
      }

      if (lookupDebounceTimeoutRef.current) {
        clearTimeout(lookupDebounceTimeoutRef.current);
      }
    };
  }, []);

  function resetLookupState() {
    setItemOptions([]);
    setActiveLookupField(null);
    setIsItemLookupLoading(false);
  }

  function loadItemOptions(searchValue: string, searchBy: LookupSearchBy) {
    const normalizedSearch = searchValue.trim();
    if (normalizedSearch.length < 2) {
      if (lookupAbortControllerRef.current) {
        lookupAbortControllerRef.current.abort();
      }
      if (lookupDebounceTimeoutRef.current) {
        clearTimeout(lookupDebounceTimeoutRef.current);
      }
      resetLookupState();
      return;
    }

    setActiveLookupField(searchBy);
    setIsItemLookupLoading(true);

    if (lookupAbortControllerRef.current) {
      lookupAbortControllerRef.current.abort();
    }
    if (lookupDebounceTimeoutRef.current) {
      clearTimeout(lookupDebounceTimeoutRef.current);
    }

    lookupDebounceTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      lookupAbortControllerRef.current = controller;

      const response = await fetch(
        `/api/customers/${encodeURIComponent(customerCode)}/item-lookup?query=${encodeURIComponent(normalizedSearch)}&searchBy=${encodeURIComponent(searchBy)}`,
        { signal: controller.signal },
      ).catch(() => null);

      if (controller.signal.aborted) {
        return;
      }

      setIsItemLookupLoading(false);

      if (!response?.ok) {
        setItemOptions([]);
        return;
      }

      const payload = (await response.json().catch(() => null)) as { items?: ItemLookupOption[] } | null;
      const options = payload?.items ?? [];
      setItemOptions(options);
    }, 220);
  }

  function closeLookupDropdownWithDelay() {
    setTimeout(() => {
      setActiveLookupField(null);
    }, 120);
  }

  function applyItemOption(option: ItemLookupOption) {
    setItemNo(option.item_no);
    setDescription(option.item_descp);
    resetLookupState();
  }

  function openModal() {
    setSubmitError(null);
    resetLookupState();
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
    resetLookupState();
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
                      loadItemOptions(value, "item_no");
                    }}
                    onFocus={() => setActiveLookupField("item_no")}
                    onBlur={closeLookupDropdownWithDelay}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                  {activeLookupField === "item_no" && itemOptions.length > 0 ? (
                    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-zinc-300 bg-white py-1 shadow-lg">
                      {itemOptions.map((option) => (
                        <li key={`${option.item_no}-${option.item_descp}`}>
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
                {isItemLookupLoading && activeLookupField === "item_no" ? (
                  <p className="mt-1 text-xs text-zinc-500">Searching items…</p>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700">Description</span>
                <div className="relative">
                  <input
                    type="text"
                    value={description}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDescription(value);
                      loadItemOptions(value, "item_descp");
                    }}
                    onFocus={() => setActiveLookupField("item_descp")}
                    onBlur={closeLookupDropdownWithDelay}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                  {activeLookupField === "item_descp" && itemOptions.length > 0 ? (
                    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-zinc-300 bg-white py-1 shadow-lg">
                      {itemOptions.map((option) => (
                        <li key={`${option.item_no}-${option.item_descp}-description`}>
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
                {isItemLookupLoading && activeLookupField === "item_descp" ? (
                  <p className="mt-1 text-xs text-zinc-500">Searching items…</p>
                ) : null}
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
