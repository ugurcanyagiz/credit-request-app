"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import Image from "next/image";

import type { CreditRequestCartItem } from "@/lib/credit-request-email";

type CartItem = CreditRequestCartItem;

type DraftResponse = {
  draft: {
    subject: string;
    html: string;
    text: string;
  };
  photos: Array<{
    fileName: string;
    publicUrl: string;
    storagePath: string;
  }>;
};

type CartPhoto = {
  fileName: string;
  publicUrl: string;
  storagePath: string;
  createdAt?: string;
  previewUrl?: string;
};

export function GlobalCartWidget() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const [pictures, setPictures] = useState<CartPhoto[]>([]);
  const [isUploadingPictures, setIsUploadingPictures] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [draftData, setDraftData] = useState<DraftResponse | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cartRows = useMemo(() => {
    const isManualNote = (item: CartItem) => item.item_descp.includes("Reason:");
    const regularItems = items.filter((item) => !isManualNote(item));
    const noteItems = items.filter((item) => isManualNote(item));
    return [...regularItems, ...noteItems];
  }, [items]);


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

  const loadPhotos = useCallback(async () => {
    const response = await fetch("/api/cart/photos", { cache: "no-store" });

    if (response.status === 401) {
      setAuthorized(false);
      return;
    }

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { photos?: CartPhoto[] };
    setPictures(payload.photos ?? []);
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

  async function onPicturesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    setSendError(null);
    setSendSuccessMessage(null);
    setDraftData(null);
    setCopiedText(false);
    setIsUploadingPictures(true);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("photos", file);
      });

      const response = await fetch("/api/cart/photos", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { photos?: CartPhoto[]; error?: string };
      if (!response.ok) {
        setSendError(payload.error ?? "Failed to upload photos.");
        return;
      }

      setPictures((previousPictures) => [...(payload.photos ?? []), ...previousPictures]);
    } catch {
      setSendError("Failed to upload photos.");
    } finally {
      setIsUploadingPictures(false);
    }
  }

  async function removePicture(storagePath: string) {
    const response = await fetch("/api/cart/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setSendError(payload?.error ?? "Failed to remove photo.");
      return;
    }

    setPictures((previousPictures) => previousPictures.filter((picture) => picture.storagePath !== storagePath));
  }

  async function prepareCreditRequestDraft() {
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
    setDraftData(null);
    setCopiedText(false);

    try {
      const formData = new FormData();
      formData.set("cartRows", JSON.stringify(cartRows));
      formData.set("photoRefs", JSON.stringify(pictures));

      const response = await fetch("/api/cart/credit-request-draft", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as DraftResponse & { error?: string };

      if (!response.ok) {
        setSendError(payload.error ?? "Failed to prepare draft.");
        return;
      }

      setDraftData(payload);
      setSendSuccessMessage(
        "Draft prepared with hosted image URLs. Copy and paste into your email provider (HTML-friendly editor recommended).",
      );
    } catch {
      setSendError("Failed to prepare the email draft.");
    } finally {
      setIsSending(false);
    }
  }

  async function copyPlainTextDraft() {
    if (!draftData?.draft.text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(`Subject: ${draftData.draft.subject}\n\n${draftData.draft.text}`);
      setCopiedText(true);
    } catch {
      setCopiedText(false);
      setSendError("Unable to copy draft text to clipboard.");
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCart();
      void loadPhotos();
    }, 0);

    function handleUpdated() {
      void loadCart();
    }

    window.addEventListener("cart-updated", handleUpdated);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("cart-updated", handleUpdated);
    };
  }, [loadCart, loadPhotos]);

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
          <div className="mx-auto max-h-[calc(100vh-1.5rem)] w-full max-w-7xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5 md:px-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">Credit Request Cart</h3>
                  <p className="mt-1 text-sm text-slate-500">Review details carefully before submitting.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void prepareCreditRequestDraft()}
                    disabled={items.length === 0 || isSending}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSending ? "Preparing Draft..." : "Prepare Hosted HTML Draft"}
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
                    <p className="text-sm font-semibold text-slate-800">Photo Evidence</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(event) => {
                      void onPicturesSelected(event);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={onPickPictures}
                    disabled={isUploadingPictures}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {isUploadingPictures ? "Uploading..." : "Add Photos"}
                  </button>
                </div>

                <div className="mt-4 min-h-14 rounded-lg border border-dashed border-slate-300 bg-white p-3">
                  {pictures.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {pictures.map((picture) => (
                        <div
                          key={picture.storagePath}
                          className="relative h-24 w-24 overflow-hidden rounded-md border border-slate-300"
                        >
                          <button
                            type="button"
                            onClick={() => void removePicture(picture.storagePath)}
                            className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white"
                            aria-label={`Remove ${picture.fileName}`}
                          >
                            ✕
                          </button>
                          <Image
                            src={picture.previewUrl ?? picture.publicUrl}
                            alt={picture.fileName}
                            width={96}
                            height={96}
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

              {draftData ? (
                <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">HTML Draft Preview</h4>
                    <button
                      type="button"
                      onClick={() => void copyPlainTextDraft()}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {copiedText ? "Copied" : "Copy Plain Text"}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">
                    Subject: <strong>{draftData.draft.subject}</strong>
                  </p>
                  <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200 bg-white p-3">
                    <div dangerouslySetInnerHTML={{ __html: draftData.draft.html }} />
                  </div>
                  <p className="text-xs text-slate-600">
                    Uploaded photos are hosted and included as real URLs in the HTML above.
                  </p>
                </section>
              ) : null}

              {sendError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{sendError}</p>
              ) : null}
              {sendSuccessMessage ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {sendSuccessMessage}
                </p>
              ) : null}
              <p className="text-xs text-slate-500">
                Recipient remains <strong>credit@turkanafood.com</strong>. This flow prepares production-safe HTML content with hosted image links.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
