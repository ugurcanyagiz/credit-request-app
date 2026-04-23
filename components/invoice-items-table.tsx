"use client";

import { useMemo, useState } from "react";

type InvoiceItem = {
  item_no: string;
  item_descp: string;
  quantity: number;
  sales_amount: number;
  sales_batch_number: string;
  sales_lot_no: string;
  batch_expiration_date: string;
  piece_price: number;
};

type CreditType = "case" | "piece";
type ReasonOption = "Damaged" | "Molded" | "Leaking" | "Sugared" | "Spoiled" | "Wrong Item" | "Expired" | "Other";

const REASON_OPTIONS: ReasonOption[] = [
  "Damaged",
  "Molded",
  "Leaking",
  "Sugared",
  "Spoiled",
  "Wrong Item",
  "Expired",
  "Other",
];

type InvoiceItemsTableProps = {
  items: InvoiceItem[];
  customerCode: string;
  invoiceNo: string;
};

export function InvoiceItemsTable({ items, customerCode, invoiceNo }: InvoiceItemsTableProps) {
  const [selectedItem, setSelectedItem] = useState<InvoiceItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [creditType, setCreditType] = useState<CreditType>("case");
  const [caseCount, setCaseCount] = useState<string>("");
  const [piecesPerCase, setPiecesPerCase] = useState<string>("");
  const [requestedPieces, setRequestedPieces] = useState<string>("");
  const [selectedReasons, setSelectedReasons] = useState<ReasonOption[]>([]);
  const [otherReason, setOtherReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const numericCaseCount = Number(caseCount);
  const numericPiecesPerCase = Number(piecesPerCase);
  const numericRequestedPieces = Number(requestedPieces);

  const pieceUnitPrice = useMemo(() => {
    if (!selectedItem || !Number.isFinite(numericPiecesPerCase) || numericPiecesPerCase <= 0) {
      return null;
    }

    return selectedItem.piece_price / numericPiecesPerCase;
  }, [numericPiecesPerCase, selectedItem]);

  const caseCreditAmount = useMemo(() => {
    if (!selectedItem || !Number.isFinite(numericCaseCount) || numericCaseCount <= 0) {
      return null;
    }

    return selectedItem.piece_price * numericCaseCount;
  }, [numericCaseCount, selectedItem]);

  const pieceCreditAmount = useMemo(() => {
    if (!pieceUnitPrice || !Number.isFinite(numericRequestedPieces) || numericRequestedPieces <= 0) {
      return null;
    }

    return pieceUnitPrice * numericRequestedPieces;
  }, [pieceUnitPrice, numericRequestedPieces]);

  const autoCreditAmount = creditType === "case" ? caseCreditAmount : pieceCreditAmount;
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

  function openModal(item: InvoiceItem) {
    setSelectedItem(item);
    setCreditType("case");
    setCaseCount("");
    setPiecesPerCase("");
    setRequestedPieces("");
    setSelectedReasons([]);
    setOtherReason("");
    setSubmitError(null);
  }

  function closeModal() {
    setSelectedItem(null);
  }

  async function addSelectedItemToCart() {
    if (!selectedItem || autoCreditAmount === null || !Number.isFinite(autoCreditAmount)) {
      return;
    }

    if (selectedReasons.length === 0) {
      setSubmitError("Please select at least one reason.");
      return;
    }

    const resolvedReasons: string[] = [
      ...selectedReasons.filter((reason) => reason !== "Other"),
      ...(selectedReasons.includes("Other") && otherReason.trim().length > 0 ? [otherReason.trim()] : []),
    ];

    if (resolvedReasons.length === 0) {
      setSubmitError("Please enter a reason for Other.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const response = await fetch("/api/cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_code: customerCode,
        invoice_no: invoiceNo,
        item_no: selectedItem.item_no,
        item_descp: selectedItem.item_descp,
        quantity: selectedItem.quantity,
        sales_amount: selectedItem.sales_amount,
        sales_batch_number: selectedItem.sales_batch_number,
        sales_lot_no: selectedItem.sales_lot_no,
        batch_expiration_date: selectedItem.batch_expiration_date,
        piece_price: selectedItem.piece_price,
        credit_type: creditType,
        credit_amount: autoCreditAmount,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setSubmitError(payload?.error ?? "Failed to add item to cart");
      setIsSubmitting(false);
      return;
    }

    const reasonResponse = await fetch("/api/cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_code: customerCode,
        invoice_no: invoiceNo,
        item_no: selectedItem.item_no,
        item_descp: `Reason: ${resolvedReasons.join(" - ")}`,
        quantity: 0,
        sales_amount: 0,
        sales_batch_number: null,
        sales_lot_no: null,
        batch_expiration_date: null,
        piece_price: 0,
        credit_type: creditType,
        credit_amount: 0,
      }),
    });

    if (!reasonResponse.ok) {
      const payload = (await reasonResponse.json().catch(() => null)) as { error?: string } | null;
      setSubmitError(payload?.error ?? "Failed to add item reason");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    window.dispatchEvent(new Event("cart-updated"));
    setSelectedItem(null);
  }


  return (
    <>
      <div className="mb-3 space-y-1">
        <label htmlFor="invoice-item-search" className="block text-sm font-medium text-zinc-700">
          Search Items
        </label>
        <input
          id="invoice-item-search"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Filter by Item No or Item Description"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left">
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
                <tr key={`${item.item_no}-${index}`} className="border-t border-zinc-200">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => openModal(item)}
                      className="font-medium text-blue-700 underline-offset-2 hover:underline"
                    >
                      {item.item_no}
                    </button>
                  </td>
                  <td className="px-3 py-2">{item.item_descp}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{item.sales_amount}</td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-zinc-200">
                <td colSpan={4} className="px-3 py-4 text-center text-zinc-500">
                  No items match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold">Product Detail & Credit Request</h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>

            <div className="grid gap-2 text-sm">
              <p><span className="font-medium">Item No:</span> {selectedItem.item_no}</p>
              <p><span className="font-medium">Item Description:</span> {selectedItem.item_descp}</p>
              <p><span className="font-medium">Quantity:</span> {selectedItem.quantity}</p>
              <p><span className="font-medium">Sales Amount:</span> {selectedItem.sales_amount}</p>
              <p><span className="font-medium">Sales Batch Number:</span> {selectedItem.sales_batch_number}</p>
              <p><span className="font-medium">Sales Lot No:</span> {selectedItem.sales_lot_no}</p>
              <p><span className="font-medium">Batch Expiration Date:</span> {selectedItem.batch_expiration_date}</p>
              <p><span className="font-medium">Case Price:</span> {selectedItem.piece_price}</p>
            </div>

            <div className="mt-5 rounded-md border border-zinc-200 p-4">
              <h4 className="mb-3 font-semibold">Reason</h4>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                {REASON_OPTIONS.map((option) => {
                  const checked = selectedReasons.includes(option);
                  return (
                    <label key={option} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedReasons((previousReasons) => [...previousReasons, option]);
                            return;
                          }

                          setSelectedReasons((previousReasons) =>
                            previousReasons.filter((reason) => reason !== option),
                          );

                          if (option === "Other") {
                            setOtherReason("");
                          }
                        }}
                      />
                      {option}
                    </label>
                  );
                })}
              </div>

              {selectedReasons.includes("Other") ? (
                <label className="mt-3 block text-sm">
                  <span className="mb-1 block text-zinc-700">Other reason</span>
                  <input
                    type="text"
                    value={otherReason}
                    onChange={(event) => setOtherReason(event.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </label>
              ) : null}
            </div>

            <div className="mt-5 rounded-md border border-zinc-200 p-4">
              <h4 className="mb-3 font-semibold">Credit Request Amount</h4>

              <div className="mb-4 flex gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="credit-type"
                    checked={creditType === "case"}
                    onChange={() => setCreditType("case")}
                  />
                  Case credit
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="credit-type"
                    checked={creditType === "piece"}
                    onChange={() => setCreditType("piece")}
                  />
                  Piece credit
                </label>
              </div>

              {creditType === "case" ? (
                <div className="space-y-2 text-sm">
                  <label className="block">
                    <span className="mb-1 block text-zinc-700">Case Quantity</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={caseCount}
                      onChange={(event) => setCaseCount(event.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <label className="block">
                    <span className="mb-1 block text-zinc-700">Pieces Per Case</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={piecesPerCase}
                      onChange={(event) => setPiecesPerCase(event.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-zinc-700">Requested Piece Quantity</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={requestedPieces}
                      onChange={(event) => setRequestedPieces(event.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2"
                    />
                  </label>
                </div>
              )}

              <div className="mt-4 rounded-md bg-zinc-50 p-3 text-sm">
                <p className="font-medium">Calculated Credit Request Amount</p>
                <p className="mt-1 text-lg font-semibold">
                  {autoCreditAmount !== null && Number.isFinite(autoCreditAmount)
                    ? autoCreditAmount.toFixed(2)
                    : "Please fill in required fields"}
                </p>
              </div>

              {submitError ? <p className="mt-3 text-sm text-red-600">{submitError}</p> : null}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void addSelectedItemToCart()}
                  disabled={autoCreditAmount === null || !Number.isFinite(autoCreditAmount) || isSubmitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
