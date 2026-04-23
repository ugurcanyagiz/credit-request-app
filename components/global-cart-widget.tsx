"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import Image from "next/image";

type CartItem = {
  id: string;
  customer_code: string;
  invoice_no: string;
  item_no: string;
  item_descp: string;
  quantity: number;
  sales_amount: number;
  piece_price: number;
  sales_batch_number: string | null;
  sales_lot_no: string | null;
  credit_type: "case" | "piece";
  credit_amount: number;
  created_at: string;
};

const CREDIT_TEAM_EMAIL = "credit@turkanafood.com";

function money(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function truncate(value: string, length: number) {
  return value.length <= length ? value : `${value.slice(0, Math.max(0, length - 3))}...`;
}

function pad(value: string, width: number, align: "left" | "right" = "left") {
  const text = truncate(value, width);
  if (text.length >= width) {
    return text;
  }

  return align === "right" ? text.padStart(width, " ") : text.padEnd(width, " ");
}

function formatUploadedPhotoReference(picture: File, index: number) {
  const readableSizeInKb = (picture.size / 1024).toFixed(1);
  const fileType = picture.type || "unknown-type";
  return `Photo ${index + 1}: ${picture.name} (${fileType}, ${readableSizeInKb} KB)`;
}

function buildMailtoDraft({
  cartRows,
  pictures,
}: {
  cartRows: CartItem[];
  pictures: File[];
}) {
  const nonNoteItems = cartRows.filter((item) => !item.item_descp.includes("Reason:"));
  const uniqueCustomers = [...new Set(cartRows.map((item) => item.customer_code).filter(Boolean))];
  const uniqueInvoices = [...new Set(cartRows.map((item) => item.invoice_no).filter(Boolean))];
  const totalCreditAmount = cartRows.reduce((sum, item) => sum + Number(item.credit_amount || 0), 0);

  const subject = `Credit Request | Customer ${uniqueCustomers.join(", ") || "N/A"} | Invoice ${
    uniqueInvoices.join(", ") || "N/A"
  } | ${cartRows.length} Item(s)`;

  const tableHeader = [
    `${pad("Item No", 12)} ${pad("Description", 24)} ${pad("Qty", 6, "right")} ${pad("Sales Amt", 10, "right")} ${pad("Price", 10, "right")}`,
    "------------------------------------------------------------",
  ];

  const tableRows = nonNoteItems.map((item) => {
    return `${pad(item.item_no || "-", 12)} ${pad(item.item_descp || "-", 24)} ${pad(String(item.quantity ?? 0), 6, "right")} ${pad(
      money(Number(item.sales_amount ?? 0)),
      10,
      "right",
    )} ${pad(money(Number(item.piece_price ?? 0)), 10, "right")}`;
  });

  const noteRows = cartRows
    .filter((item) => item.item_descp.includes("Reason:"))
    .map((item) => item.item_descp.replace("Reason:", "").trim())
    .filter(Boolean);

  const photoLines = pictures.map((picture, index) => formatUploadedPhotoReference(picture, index));

  const bodySections = [
    "Hello Team,",
    "",
    "Please review the credit request details below.",
    "",
    `Customer Code(s): ${uniqueCustomers.join(", ") || "-"}`,
    `Invoice No(s): ${uniqueInvoices.join(", ") || "-"}`,
    `Total Requested Credit Amount: ${money(totalCreditAmount)}`,
    "",
    "Selected Items:",
    "------------------------------------------------------------",
    ...tableHeader,
    ...(tableRows.length > 0 ? tableRows : ["(No selected product rows found)"]),
    "------------------------------------------------------------",
    "",
    ...(noteRows.length > 0 ? ["Notes:", ...noteRows.map((note, index) => `${index + 1}. ${note}`), ""] : []),
    ...(photoLines.length > 0
      ? ["Uploaded Photo References:", ...photoLines, "", "Please find the related photos above.", ""]
      : ["Uploaded Photo References: None", ""]),
    "Thank you.",
  ];

  const body = bodySections.join("\n");
  return `mailto:${CREDIT_TEAM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function GlobalCartWidget() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const [pictures, setPictures] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cartRows = useMemo(() => {
    const isManualNote = (item: CartItem) => item.item_descp.includes("Reason:");
    const regularItems = items.filter((item) => !isManualNote(item));
    const noteItems = items.filter((item) => isManualNote(item));
    return [...regularItems, ...noteItems];
  }, [items]);

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.credit_amount || 0), 0),
    [items],
  );

  const uniqueCustomers = useMemo(
    () => [...new Set(cartRows.map((item) => item.customer_code))],
    [cartRows],
  );

  const uniqueInvoices = useMemo(
    () => [...new Set(cartRows.map((item) => item.invoice_no))],
    [cartRows],
  );

  const picturePreviews = useMemo(
    () =>
      pictures.map((picture) => ({
        key: `${picture.name}-${picture.lastModified}-${picture.size}`,
        name: picture.name,
        url: URL.createObjectURL(picture),
      })),
    [pictures],
  );

  const loadCart = useCallback(async () => {
    const response = await fetch("/api/cart", { cache: "no-store" });

    if (response.status === 401) {
      setAuthorized(false);
      return;
    }

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { items?: CartItem[] };
    setItems(payload.items ?? []);
    setAuthorized(true);
  }, []);

  async function removeItem(id: string) {
    const response = await fetch(`/api/cart?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      return;
    }

    await loadCart();
  }

  function onPickPictures() {
    fileInputRef.current?.click();
  }

  function onPicturesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setPictures((previousPictures) => [...previousPictures, ...files]);
    setSendError(null);
    setSendSuccessMessage(null);
    event.target.value = "";
  }

  function removePicture(index: number) {
    setPictures((previousPictures) => previousPictures.filter((_, pictureIndex) => pictureIndex !== index));
  }

  function sendCreditRequestEmail() {
    if (cartRows.length === 0 || isSending) {
      return;
    }

    const hasMissingRequiredItemData = cartRows.some(
      (item) => !item.customer_code || !item.invoice_no || !item.item_no || !item.item_descp,
    );

    if (hasMissingRequiredItemData) {
      setSendError("Unable to prepare draft. Some cart fields are missing required values.");
      return;
    }

    setIsSending(true);
    setSendError(null);
    setSendSuccessMessage(null);

    try {
      const mailtoHref = buildMailtoDraft({
        cartRows,
        pictures,
      });

      window.location.href = mailtoHref;
      setSendSuccessMessage(
        "Email draft opened in your default mail client. Review and send to credit@turkanafood.com.",
      );
    } catch {
      setSendError("Failed to prepare the email draft.");
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCart();
    }, 0);

    function handleUpdated() {
      void loadCart();
    }

    window.addEventListener("cart-updated", handleUpdated);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("cart-updated", handleUpdated);
    };
  }, [loadCart]);

  useEffect(() => {
    return () => {
      picturePreviews.forEach((picturePreview) => {
        URL.revokeObjectURL(picturePreview.url);
      });
    };
  }, [picturePreviews]);

  if (!authorized) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed right-4 top-4 z-40 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        Cart ({items.length})
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 md:p-8">
          <div className="mx-auto w-full max-w-7xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5 md:px-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">Credit Request Cart</h3>
                  <p className="mt-1 text-sm text-slate-500">Review details carefully before submitting.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={sendCreditRequestEmail}
                    disabled={items.length === 0 || isSending}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSending ? "Preparing Draft..." : "Send Credit Request"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6 md:px-8">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer Information</p>
                  <p className="mt-2 text-sm text-slate-700">{uniqueCustomers.join(", ") || "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice Information</p>
                  <p className="mt-2 text-sm text-slate-700">{uniqueInvoices.join(", ") || "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credit Summary</p>
                  <p className="mt-2 text-sm text-slate-700">
                    Rows: <strong>{cartRows.length}</strong> · Total: <strong>{totalAmount.toFixed(2)}</strong>
                  </p>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                  No items in cart yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold">Customer Code</th>
                        <th className="px-3 py-3 text-left font-semibold">Invoice No</th>
                        <th className="px-3 py-3 text-left font-semibold">Item No</th>
                        <th className="px-3 py-3 text-left font-semibold">Item Description</th>
                        <th className="px-3 py-3 text-right font-semibold">Qty</th>
                        <th className="px-3 py-3 text-right font-semibold">Sales Amount</th>
                        <th className="px-3 py-3 text-right font-semibold">Piece Price</th>
                        <th className="px-3 py-3 text-center font-semibold">Credit Type</th>
                        <th className="px-3 py-3 text-right font-semibold">Credit Amount</th>
                        <th className="px-3 py-3 text-center font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartRows.map((item) => (
                        <tr key={item.id} className="border-t border-slate-200 text-slate-700">
                          <td className="px-3 py-3">{item.customer_code}</td>
                          <td className="px-3 py-3">{item.invoice_no}</td>
                          <td className="px-3 py-3">{item.item_no}</td>
                          <td className="px-3 py-3">{item.item_descp}</td>
                          <td className="px-3 py-3 text-right">{item.quantity ?? 0}</td>
                          <td className="px-3 py-3 text-right">{Number(item.sales_amount ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-3 text-right">{Number(item.piece_price ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-3 text-center">{item.credit_type}</td>
                          <td className="px-3 py-3 text-right">{Number(item.credit_amount).toFixed(2)}</td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => void removeItem(item.id)}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Photo References</p>
                    <p className="text-xs text-slate-500">
                      Upload photo evidence. References will be listed in the email draft body.
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={onPicturesSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={onPickPictures}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Add Photos
                  </button>
                </div>

                <div className="mt-4 min-h-14 rounded-lg border border-dashed border-slate-300 bg-white p-3">
                  {pictures.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {picturePreviews.map((picturePreview, index) => (
                        <div
                          key={`${picturePreview.key}-${index}`}
                          className="relative h-24 w-24 overflow-hidden rounded-md border border-slate-300"
                        >
                          <button
                            type="button"
                            onClick={() => removePicture(index)}
                            className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white"
                            aria-label={`Remove ${picturePreview.name}`}
                          >
                            ✕
                          </button>
                          <Image
                            src={picturePreview.url}
                            alt={picturePreview.name}
                            width={96}
                            height={96}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No photos uploaded.</p>
                  )}
                </div>
              </div>

              {sendError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{sendError}</p>
              ) : null}
              {sendSuccessMessage ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {sendSuccessMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
