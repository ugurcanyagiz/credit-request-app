"use client";

import { useState } from "react";

type NotFromRecentInvoicesNoteProps = {
  customerCode: string;
};

export function NotFromRecentInvoicesNote({ customerCode }: NotFromRecentInvoicesNoteProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function addNoteToCart() {
    setIsSubmitting(true);
    setSubmitError(null);

    const response = await fetch("/api/cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_code: customerCode,
        invoice_no: "NOT_FROM_RECENT_INVOICES",
        item_no: "NOT_FROM_RECENT_INVOICES",
        item_descp: "Please add credit note if the item is not from the invoices above",
        quantity: 0,
        sales_amount: 0,
        sales_batch_number: null,
        sales_lot_no: null,
        batch_expiration_date: null,
        piece_price: 0,
        credit_type: "case",
        credit_amount: 0,
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setSubmitError(payload?.error ?? "Failed to add note to cart");
      return;
    }

    window.dispatchEvent(new Event("cart-updated"));
  }

  return (
    <div className="mt-5 rounded-md border border-zinc-200 p-4">
      <h3 className="text-base font-semibold">Not from recent invoices</h3>
      <p className="mt-1 text-sm text-zinc-600">
        Please add credit note if the item is not from the invoices above
      </p>

      {submitError ? <p className="mt-2 text-sm text-red-600">{submitError}</p> : null}

      <div className="mt-3">
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
  );
}
