"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

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
    setPictures(files);
    setSendError(null);
    setSendSuccessMessage(null);
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
      "Descrp",
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

    const lines = [
      "Credit Request",
      "",
      headers.join(" | "),
      ...rows.map((row) => row.join(" | ")),
      "",
      `Total Amount: ${totalAmount.toFixed(2)}`,
    ];

    try {
      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: pictures }) &&
        typeof navigator.share === "function";

      if (canShareFiles && pictures.length > 0) {
        await navigator.share({
          title: "Credit Request",
          text: lines.join("\n"),
          files: pictures,
        });
      } else {
        const body =
          pictures.length > 0
            ? `${lines.join("\n")}\n\nSelected Pictures:\n${pictures.map((file) => `- ${file.name}`).join("\n")}`
            : lines.join("\n");
        const mailtoUrl = `mailto:credit@turkanafood.com?subject=${encodeURIComponent("Credit Request")}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;

        if (pictures.length > 0) {
          setSendError(
            "Your browser does not support file attachments in share mode. Please attach selected pictures manually in your email client.",
          );
          return;
        }
      }

      if (pictures.length > 0) {
        setSendSuccessMessage("Credit request prepared with selected pictures.");
        return;
      }

      setSendSuccessMessage("Credit request email prepared successfully.");
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

                <div className="mt-4 flex flex-wrap items-center gap-3">
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
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50"
                  >
                    Add Pictures
                  </button>
                  <p className="text-xs text-zinc-600">
                    {pictures.length > 0
                      ? `${pictures.length} picture(s) selected`
                      : "No picture selected"}
                  </p>
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
