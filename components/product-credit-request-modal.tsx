"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

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
type ReasonOption =
  | "Damaged"
  | "Molded"
  | "Leaking"
  | "Sugared"
  | "Spoiled"
  | "Wrong Item"
  | "Expired"
  | "Missing"
  | "Refused"
  | "Other";

const REASON_OPTIONS: ReasonOption[] = [
  "Damaged",
  "Molded",
  "Leaking",
  "Sugared",
  "Spoiled",
  "Wrong Item",
  "Expired",
  "Missing",
  "Refused",
  "Other",
];

type ProductCreditRequestModalProps = {
  item: InvoiceItem;
  customerCode: string;
  invoiceNo: string;
  onClose: () => void;
};

export function ProductCreditRequestModal({ item, customerCode, invoiceNo, onClose }: ProductCreditRequestModalProps) {
  const [creditType, setCreditType] = useState<CreditType>("case");
  const [caseCount, setCaseCount] = useState<string>("");
  const [piecesPerCase, setPiecesPerCase] = useState<string>("");
  const [requestedPieces, setRequestedPieces] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<ReasonOption | null>(null);
  const [otherReason, setOtherReason] = useState("");
  const [isReasonDropdownOpen, setIsReasonDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const pictureInputRef = useRef<HTMLInputElement | null>(null);
  const reasonDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isReasonDropdownOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!reasonDropdownRef.current?.contains(target)) {
        setIsReasonDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isReasonDropdownOpen]);

  const numericCaseCount = Number(caseCount);
  const numericPiecesPerCase = Number(piecesPerCase);
  const numericRequestedPieces = Number(requestedPieces);

  const pieceUnitPrice = useMemo(() => {
    if (!Number.isFinite(numericPiecesPerCase) || numericPiecesPerCase <= 0) {
      return null;
    }

    return item.piece_price / numericPiecesPerCase;
  }, [item.piece_price, numericPiecesPerCase]);

  const caseCreditAmount = useMemo(() => {
    if (!Number.isFinite(numericCaseCount) || numericCaseCount <= 0) {
      return null;
    }

    if (numericCaseCount > item.quantity) {
      return null;
    }

    return item.piece_price * numericCaseCount;
  }, [item.piece_price, item.quantity, numericCaseCount]);

  const pieceCreditAmount = useMemo(() => {
    if (!pieceUnitPrice || !Number.isFinite(numericRequestedPieces) || numericRequestedPieces <= 0) {
      return null;
    }

    return pieceUnitPrice * numericRequestedPieces;
  }, [pieceUnitPrice, numericRequestedPieces]);

  const autoCreditAmount = creditType === "case" ? caseCreditAmount : pieceCreditAmount;

  async function addSelectedItemToCart() {
    if (autoCreditAmount === null || !Number.isFinite(autoCreditAmount)) {
      return;
    }

    if (creditType === "case" && numericCaseCount > item.quantity) {
      setSubmitError(`Case quantity cannot be greater than ${item.quantity}.`);
      return;
    }

    if (!selectedReason) {
      setSubmitError("Please select at least one reason.");
      return;
    }

    const resolvedReasons: string[] = [
      ...(selectedReason !== "Other" ? [selectedReason] : []),
      ...(selectedReason === "Other" && otherReason.trim().length > 0 ? [otherReason.trim()] : []),
    ];

    if (resolvedReasons.length === 0) {
      setSubmitError("Please enter a reason for Other.");
      return;
    }

    const requestedQuantity = creditType === "case" ? numericCaseCount : numericRequestedPieces;
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      setSubmitError("Please enter a valid requested quantity.");
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
        item_no: item.item_no,
        item_descp: item.item_descp,
        quantity: requestedQuantity,
        sales_amount: item.sales_amount,
        sales_batch_number: item.sales_batch_number,
        sales_lot_no: item.sales_lot_no,
        batch_expiration_date: item.batch_expiration_date,
        piece_price: item.piece_price,
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
        item_no: item.item_no,
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
    onClose();
  }

  function onPickPicture() {
    const isConfirmed = window.confirm("Please make sure LOT NUMBER is visible.");
    if (!isConfirmed) {
      return;
    }

    pictureInputRef.current?.click();
  }

  async function onPictureSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    setIsUploadingPicture(true);
    setPictureError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("photos", file);
      });

      const response = await fetch("/api/cart/photos", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setPictureError(payload?.error ?? "Failed to upload picture.");
        return;
      }

      window.dispatchEvent(new Event("cart-photos-updated"));
    } catch {
      setPictureError("Failed to upload picture.");
    } finally {
      setIsUploadingPicture(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="mx-auto my-4 max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-lg bg-white dark:bg-zinc-900 p-5 shadow-xl sm:my-0 sm:max-h-[90vh]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold">Product Detail & Credit Request</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs"
          >
            Close
          </button>
        </div>

        <div className="grid gap-2 text-sm">
          <p><span className="font-medium">Item No:</span> {item.item_no}</p>
          <p><span className="font-medium">Item Description:</span> {item.item_descp}</p>
          <p><span className="font-medium">Quantity:</span> {item.quantity}</p>
          <p><span className="font-medium">Sales Amount:</span> {item.sales_amount}</p>
          <p><span className="font-medium">Sales Batch Number:</span> {item.sales_batch_number}</p>
          <p><span className="font-medium">Sales Lot No:</span> {item.sales_lot_no}</p>
          <p><span className="font-medium">Batch Expiration Date:</span> {item.batch_expiration_date}</p>
          <p><span className="font-medium">Case Price:</span> {item.piece_price}</p>
        </div>

        <div className="mt-5 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
          <h4 className="mb-3 font-semibold">Reason</h4>
          <div ref={reasonDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setIsReasonDropdownOpen((previous) => !previous)}
              className="flex w-full items-center justify-between rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-left text-sm"
            >
              <span className="truncate">
                {selectedReason ?? "Select reason"}
              </span>
              <span className="ml-3 text-xs text-zinc-500 dark:text-zinc-400">{isReasonDropdownOpen ? "▲" : "▼"}</span>
            </button>

            <div
              className={`absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-zinc-300 bg-white p-2 shadow-lg transition-all duration-200 ease-out dark:border-zinc-700 dark:bg-zinc-900 ${
                isReasonDropdownOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              }`}
            >
              <div className="grid gap-2 text-sm">
                {REASON_OPTIONS.map((option) => {
                  const checked = selectedReason === option;
                  return (
                    <label key={option} className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="credit-request-reason"
                        checked={checked}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedReason(option);
                            setIsReasonDropdownOpen(false);
                            if (option !== "Other") {
                              setOtherReason("");
                            }
                          }
                        }}
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedReason === "Other" ? (
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-zinc-700 dark:text-zinc-200">Other reason</span>
              <input
                type="text"
                value={otherReason}
                onChange={(event) => setOtherReason(event.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
              />
            </label>
          ) : null}
        </div>

        <div className="mt-5 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
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
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">Case Quantity</span>
                <input
                  type="number"
                  min="0"
                  max={item.quantity}
                  step="1"
                  value={caseCount}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const nextCaseCount = Number(nextValue);
                    if (!Number.isFinite(nextCaseCount)) {
                      setCaseCount("");
                      return;
                    }

                    if (nextCaseCount > item.quantity) {
                      setCaseCount(String(item.quantity));
                      return;
                    }

                    setCaseCount(nextValue);
                  }}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                />
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Maximum allowed: {item.quantity}</p>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">Pieces Per Case</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={piecesPerCase}
                  onChange={(event) => setPiecesPerCase(event.target.value.replace(/\D/g, ""))}
                  placeholder="How many piece are in one case"
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                />
                {piecesPerCase.trim().length === 0 ? (
                  <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                    Please enter how many pieces are in one case.
                  </span>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">Requested Piece Quantity</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={requestedPieces}
                  onChange={(event) => setRequestedPieces(event.target.value.replace(/\D/g, ""))}
                  placeholder="How any pieces are requested for credit"
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                />
                {requestedPieces.trim().length === 0 ? (
                  <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                    Please enter the number of pieces to request credit for.
                  </span>
                ) : null}
              </label>
            </div>
          )}

          <div className="mt-4 rounded-md bg-zinc-50 dark:bg-zinc-900/40 p-3 text-sm">
            <p className="font-medium">Calculated Credit Request Amount</p>
            <p className="mt-1 text-lg font-semibold">
              {autoCreditAmount !== null && Number.isFinite(autoCreditAmount)
                ? autoCreditAmount.toFixed(2)
                : "Please fill in required fields"}
            </p>
          </div>

          {submitError ? <p className="mt-3 text-sm text-red-600">{submitError}</p> : null}
          {pictureError ? <p className="mt-3 text-sm text-red-600">{pictureError}</p> : null}

          <input
            ref={pictureInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void onPictureSelected(event)}
          />

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onPickPicture}
              disabled={isUploadingPicture || isSubmitting}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploadingPicture ? "Uploading..." : "Add Picture"}
            </button>
            <button
              type="button"
              onClick={() => void addSelectedItemToCart()}
              disabled={
                autoCreditAmount === null ||
                !Number.isFinite(autoCreditAmount) ||
                isSubmitting ||
                isUploadingPicture
              }
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { InvoiceItem };
