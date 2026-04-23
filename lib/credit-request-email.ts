export type CreditType = "case" | "piece";

export type CreditRequestCartItem = {
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
  credit_type: CreditType;
  credit_amount: number;
  created_at: string;
};

export type UploadedPhotoReference = {
  fileName: string;
  publicUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

export function buildCreditRequestDraft({
  cartRows,
  uploadedPhotos,
}: {
  cartRows: CreditRequestCartItem[];
  uploadedPhotos: UploadedPhotoReference[];
}) {
  const nonNoteItems = cartRows.filter((item) => !item.item_descp.includes("Reason:"));
  const uniqueCustomers = [...new Set(cartRows.map((item) => item.customer_code).filter(Boolean))];
  const uniqueInvoices = [...new Set(cartRows.map((item) => item.invoice_no).filter(Boolean))];
  const totalCreditAmount = cartRows.reduce((sum, item) => sum + Number(item.credit_amount || 0), 0);

  const subject = `Credit Request | Customer ${uniqueCustomers.join(", ") || "N/A"} | Invoice ${
    uniqueInvoices.join(", ") || "N/A"
  } | ${cartRows.length} Item(s)`;

  const noteRows = cartRows
    .filter((item) => item.item_descp.includes("Reason:"))
    .map((item) => item.item_descp.replace("Reason:", "").trim())
    .filter(Boolean);

  const textLines = [
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
    ...nonNoteItems.map(
      (item) =>
        `${item.item_no || "-"} | ${item.item_descp || "-"} | Qty: ${item.quantity ?? 0} | Sales Amt: ${money(
          Number(item.sales_amount ?? 0),
        )} | Price: ${money(Number(item.piece_price ?? 0))}`,
    ),
    "------------------------------------------------------------",
    "",
    ...(noteRows.length > 0 ? ["Notes:", ...noteRows.map((note, index) => `${index + 1}. ${note}`), ""] : []),
    ...(uploadedPhotos.length > 0
      ? [
          "Uploaded Photos:",
          ...uploadedPhotos.map((photo, index) => `${index + 1}. ${photo.fileName}: ${photo.publicUrl}`),
          "",
        ]
      : ["Uploaded Photos: None", ""]),
    "Thank you.",
  ];

  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.4;">
    <p>Hello Team,</p>
    <p>Please review the credit request details below.</p>

    <p><strong>Customer Code(s):</strong> ${escapeHtml(uniqueCustomers.join(", ") || "-")}<br />
    <strong>Invoice No(s):</strong> ${escapeHtml(uniqueInvoices.join(", ") || "-")}<br />
    <strong>Total Requested Credit Amount:</strong> ${escapeHtml(money(totalCreditAmount))}</p>

    <h3 style="margin-bottom: 8px;">Selected Items</h3>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 13px;">
      <thead style="background-color: #e2e8f0;">
        <tr>
          <th align="left">Item No</th>
          <th align="left">Description</th>
          <th align="right">Qty</th>
          <th align="right">Sales Amt</th>
          <th align="right">Price</th>
        </tr>
      </thead>
      <tbody>
        ${
          nonNoteItems.length > 0
            ? nonNoteItems
                .map(
                  (item) => `<tr>
          <td>${escapeHtml(item.item_no || "-")}</td>
          <td>${escapeHtml(item.item_descp || "-")}</td>
          <td align="right">${escapeHtml(String(item.quantity ?? 0))}</td>
          <td align="right">${escapeHtml(money(Number(item.sales_amount ?? 0)))}</td>
          <td align="right">${escapeHtml(money(Number(item.piece_price ?? 0)))}</td>
        </tr>`,
                )
                .join("\n")
            : `<tr><td colspan="5">No selected product rows found</td></tr>`
        }
      </tbody>
    </table>

    ${
      noteRows.length > 0
        ? `<h3 style="margin-bottom: 8px;">Notes</h3>
           <ol>${noteRows.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ol>`
        : ""
    }

    <h3 style="margin-bottom: 8px;">Uploaded Photos</h3>
    ${
      uploadedPhotos.length > 0
        ? `<div style="display: flex; flex-wrap: wrap; gap: 16px;">${uploadedPhotos
            .map(
              (photo) => `<figure style="margin: 0; width: 220px;">
              <img src="${escapeHtml(photo.publicUrl)}" alt="${escapeHtml(photo.fileName)}" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; object-fit: cover;" />
              <figcaption style="font-size: 12px; margin-top: 4px;">${escapeHtml(photo.fileName)}</figcaption>
            </figure>`,
            )
            .join("")}</div>`
        : "<p>No photos uploaded.</p>"
    }

    <p>Thank you.</p>
  </body>
</html>`;

  return {
    subject,
    html,
    text: textLines.join("\n"),
  };
}
