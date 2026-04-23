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

const CREDIT_REQUEST_RECIPIENT = "credit@turkanafood.com";

function money(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function toReasonText(itemDescription: string) {
  return itemDescription.replace("Reason:", "").trim();
}

function toTableRow(columns: string[], widths: number[]) {
  return columns
    .map((value, index) => {
      const normalizedValue = truncate(value, widths[index]).replace(/\s+/g, " ");
      return normalizedValue.padEnd(widths[index], " ");
    })
    .join(" | ");
}

export function buildCreditRequestDraftText({
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

  const subject = `Credit Request - Customer ${uniqueCustomers.join(", ") || "N/A"} - Invoice ${
    uniqueInvoices.join(", ") || "N/A"
  } - ${nonNoteItems.length} Item(s) - Total ${money(totalCreditAmount)}`;

  const noteRows = cartRows
    .filter((item) => item.item_descp.includes("Reason:"))
    .map((item) => toReasonText(item.item_descp))
    .filter(Boolean);

  const rowWidths = [10, 38, 6, 14, 12] as const;
  const headerRow = toTableRow(["Item No", "Description", "Qty", "Sales Amount", "Piece Price"], [...rowWidths]);
  const dividerRow = rowWidths.map((width) => "-".repeat(width)).join("-+-");

  const textLines = [
    "Hello Credit Team,",
    "",
    "Please review the credit request details below.",
    "",
    "Customer Information",
    `- Customer Code(s): ${uniqueCustomers.join(", ") || "-"}`,
    "",
    "Invoice Information",
    `- Invoice No(s): ${uniqueInvoices.join(", ") || "-"}`,
    `- Total Requested Credit Amount: ${money(totalCreditAmount)}`,
    "",
    "Selected Items",
    headerRow,
    dividerRow,
    ...(nonNoteItems.length > 0
      ? nonNoteItems.map((item) =>
          toTableRow(
            [
              item.item_no || "-",
              item.item_descp || "-",
              String(item.quantity ?? 0),
              money(Number(item.sales_amount ?? 0)),
              money(Number(item.piece_price ?? 0)),
            ],
            [...rowWidths],
          ),
        )
      : ["No selected product rows found."]),
    "",
    ...(noteRows.length > 0 ? ["Notes / Comments", ...noteRows.map((note, index) => `${index + 1}. ${note}`), ""] : []),
    ...(uploadedPhotos.some((photo) => Boolean(photo.publicUrl))
      ? [
          "Photo Links",
          ...uploadedPhotos
            .filter((photo) => Boolean(photo.publicUrl))
            .map((photo, index) => `${index + 1}. ${photo.fileName}: ${photo.publicUrl}`),
          "",
        ]
      : ["Photo Links", "No hosted photo links available.", ""]),
    "Thank you.",
  ];

  return {
    subject,
    text: textLines.join("\n"),
  };
}

const MAX_MAILTO_URL_LENGTH = 1800;

export function buildCreditRequestMailtoUrl({ subject, text }: { subject: string; text: string }) {
  const buildUrl = (body: string) =>
    `mailto:${CREDIT_REQUEST_RECIPIENT}?${new URLSearchParams({ subject, body }).toString()}`;

  const fullUrl = buildUrl(text);
  if (fullUrl.length <= MAX_MAILTO_URL_LENGTH) {
    return { url: fullUrl, isBodyTruncated: false };
  }

  const truncationNotice = "\n\n[Email body truncated to fit mail client limits. Please review request details in app if needed.]";
  const allowedBodyLength = Math.max(300, text.length - (fullUrl.length - MAX_MAILTO_URL_LENGTH) - truncationNotice.length);
  const truncatedText = `${text.slice(0, allowedBodyLength)}${truncationNotice}`;

  return {
    url: buildUrl(truncatedText),
    isBodyTruncated: true,
  };
}

export { CREDIT_REQUEST_RECIPIENT };
