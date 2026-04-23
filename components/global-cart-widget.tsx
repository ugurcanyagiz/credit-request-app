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
  sales_batch_number: string | null;
  sales_lot_no: string | null;
  credit_type: "case" | "piece";
  credit_amount: number;
  created_at: string;
};

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

  async function sendCreditRequestEmail() {
    if (items.length === 0 || isSending) {
      return;
    }

    setIsSending(true);
    setSendError(null);
    setSendSuccessMessage(null);

    const headers = [
      "Customer Code",
      "Invoice",
      "Item",
      "Description",
      "Type",
      "Amount",
      "Batch No",
      "Lot No",
    ];

    const rows = cartRows.map((item) => [
      item.customer_code,
      item.invoice_no,
      item.item_no,
      item.item_descp,
      item.credit_type,
      Number(item.credit_amount).toFixed(2),
      item.sales_batch_number ?? "-",
      item.sales_lot_no ?? "-",
    ]);

    const columnWidths = headers.map((header, index) =>
      Math.max(header.length, ...rows.map((row) => String(row[index]).length)),
    );

    function formatTableRow(row: string[]) {
      return `| ${row.map((cell, index) => String(cell).padEnd(columnWidths[index], " ")).join(" | ")} |`;
    }

    const tableDivider = `|-${columnWidths.map((width) => "-".repeat(width)).join("-|-")}-|`;
    const formattedTable = [
      formatTableRow(headers),
      tableDivider,
      ...rows.map((row) => formatTableRow(row)),
    ];

    const lines = [
      "Dear Credit Department,",
      "",
      "Please find the credit request details below;",
      "",
      ...formattedTable,
      "",
      `| ${"".padEnd(columnWidths.slice(0, headers.length - 1).reduce((sum, width) => sum + width + 3, 0), " ")} | ${"Total Amount".padEnd(columnWidths[headers.length - 1], " ")} |`,
      `|-${"-".repeat(columnWidths.slice(0, headers.length - 1).reduce((sum, width) => sum + width + 3, 0))}-|-${"-".repeat(columnWidths[headers.length - 1])}-|`,
      `| ${"".padEnd(columnWidths.slice(0, headers.length - 1).reduce((sum, width) => sum + width + 3, 0), " ")} | ${totalAmount.toFixed(2).padEnd(columnWidths[headers.length - 1], " ")} |`,
      "",
      "PHOTOS:",
      pictures.length > 0 ? pictures.map((file) => `- ${file.name}`).join("\n") : "- None",
      `Total Amount: ${totalAmount.toFixed(2)}`,
    ];

    try {
      const body = lines.join("\n");

      const mailtoUrl = `mailto:credit@turkanafood.com?subject=${encodeURIComponent("Credit Request")}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoUrl;

      if (pictures.length > 0) {
        setSendError("Please attach selected pictures manually in your email client.");
        return;
      }

      setSendSuccessMessage("Credit request draft prepared successfully.");
    } catch {
      setSendError("Failed to send credit request email.");
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
        className="fixed right-4 top-4 z-40 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-zinc-50"
      >
        🛒 Cart ({items.length})
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Cart</h3>
                <p className="text-sm text-zinc-600">Total amount: {totalAmount.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={sendCreditRequestEmail}
                  disabled={items.length === 0 || isSending}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSending ? "Sending..." : "Send Credit Request"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                >
                  Close
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-zinc-600">No items in cart yet.</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border border-zinc-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Customer</th>
                        <th className="px-3 py-2 font-medium">Invoice</th>
                        <th className="px-3 py-2 font-medium">Item</th>
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Batch No</th>
                        <th className="px-3 py-2 font-medium">Lot No</th>
                        <th className="px-3 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartRows.map((item) => (
                        <tr key={item.id} className="border-t border-zinc-200">
                          <td className="px-3 py-2">{item.customer_code}</td>
                          <td className="px-3 py-2">{item.invoice_no}</td>
                          <td className="px-3 py-2">{item.item_no}</td>
                          <td className="px-3 py-2">{item.item_descp}</td>
                          <td className="px-3 py-2">{item.credit_type}</td>
                          <td className="px-3 py-2">{Number(item.credit_amount).toFixed(2)}</td>
                          <td className="px-3 py-2">{item.sales_batch_number ?? "-"}</td>
                          <td className="px-3 py-2">{item.sales_lot_no ?? "-"}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => void removeItem(item.id)}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex flex-col items-center gap-3">
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
                    className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-300 text-3xl hover:bg-zinc-50"
                    aria-label="Add Pictures"
                    title="Add Pictures"
                  >
                    📷
                  </button>

                  <div className="w-full rounded-md border border-zinc-200 bg-zinc-50 p-3">
                    {pictures.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {picturePreviews.map((picturePreview, index) => (
                          <div
                            key={`${picturePreview.key}-${index}`}
                            className="relative h-20 w-20 overflow-hidden rounded-md border border-zinc-300 bg-white"
                          >
                            <button
                              type="button"
                              onClick={() => removePicture(index)}
                              className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                              aria-label={`Remove ${picturePreview.name}`}
                            >
                              ✕
                            </button>
                            <Image
                              src={picturePreview.url}
                              alt={picturePreview.name}
                              width={80}
                              height={80}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600">No picture selected</p>
                    )}
                  </div>
                </div>

                {sendError ? <p className="mt-2 text-xs text-red-600">{sendError}</p> : null}
                {sendSuccessMessage ? (
                  <p className="mt-2 text-xs text-emerald-600">{sendSuccessMessage}</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
