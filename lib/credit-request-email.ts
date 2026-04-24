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

function isEmailStandaloneReasonRow(itemDescription: string) {
  return itemDescription.trim().startsWith("Reason:");
}

function parseEmailReasonAndDescription(itemDescription: string) {
  const normalizedDescription = itemDescription.trim();

  if (normalizedDescription.startsWith("Reason:")) {
    const reason = normalizedDescription.replace(/^Reason:/, "").trim();
    return { description: "-", reason: reason.length > 0 ? reason : null };
  }

  const splitOnReason = normalizedDescription.split(/\s*\|\s*Reason:\s*/i);
  if (splitOnReason.length > 1) {
    const [descriptionPart, ...reasonParts] = splitOnReason;
    const reason = reasonParts.join(" | ").trim();
    return {
      description: descriptionPart.trim() || "-",
      reason: reason.length > 0 ? reason : null,
    };
  }

  return { description: normalizedDescription || "-", reason: null };
}

function toEmailReasonRowKey(item: CreditRequestCartItem) {
  return `${item.customer_code}::${item.invoice_no}::${item.item_no}`;
}

function compactText(value: string, maxLength: number) {
  return truncate((value || "-").replace(/\s+/g, " ").trim(), maxLength);
}

function compactDetail(label: string, value: string, maxLength: number) {
  return `${label}: ${compactText(value, maxLength)}`;
}

function formatSelectedItemBlock({
  item,
  description,
  reason,
}: {
  item: CreditRequestCartItem;
  description: string;
  reason: string;
}) {
  const primaryLine = [
    compactDetail("Item", item.item_no || "-", 20),
    compactDetail("Customer", item.customer_code || "-", 16),
    compactDetail("Invoice", item.invoice_no || "-", 16),
    compactDetail("Qty", String(item.quantity ?? 0), 8),
    compactDetail("Amount", money(Number(item.credit_amount ?? 0)), 14),
  ].join("   ");

  const secondaryDetails = [
    `Desc: ${compactText(description, 34)}`,
    compactDetail("Reason", reason || "-", 30),
    compactDetail("Batch", item.sales_batch_number || "-", 18),
    compactDetail("Lot", item.sales_lot_no || "-", 18),
    compactDetail("Type", item.credit_type || "-", 8),
  ].join("   ");

  return [primaryLine, secondaryDetails];
}

function encodeMailtoValue(value: string) {
  return encodeURIComponent(value);
}

export function buildCreditRequestDraftText({
  cartRows,
  uploadedPhotos,
}: {
  cartRows: CreditRequestCartItem[];
  uploadedPhotos: UploadedPhotoReference[];
}) {
  const nonNoteItems = cartRows.filter((item) => !isEmailStandaloneReasonRow(item.item_descp));
  const reasonRowsByKey = new Map<string, string[]>();

  for (const item of cartRows) {
    if (!isEmailStandaloneReasonRow(item.item_descp)) {
      continue;
    }

    const parsed = parseEmailReasonAndDescription(item.item_descp);
    if (!parsed.reason) {
      continue;
    }

    const key = toEmailReasonRowKey(item);
    const existing = reasonRowsByKey.get(key) ?? [];
    existing.push(parsed.reason);
    reasonRowsByKey.set(key, existing);
  }

  const displayRows = nonNoteItems.map((item) => {
    const parsed = parseEmailReasonAndDescription(item.item_descp);
    const key = toEmailReasonRowKey(item);
    const queuedReason = reasonRowsByKey.get(key)?.shift() ?? null;

    return {
      item,
      description: parsed.description,
      reason: parsed.reason ?? queuedReason ?? "—",
    };
  });

  const uniqueCustomers = [...new Set(cartRows.map((item) => item.customer_code).filter(Boolean))];
  const uniqueInvoices = [...new Set(cartRows.map((item) => item.invoice_no).filter(Boolean))];
  const totalCreditAmount = cartRows.reduce((sum, item) => sum + Number(item.credit_amount || 0), 0);

  const subject = `Credit Request - Customer ${uniqueCustomers.join(", ") || "N/A"} - Invoice ${
    uniqueInvoices.join(", ") || "N/A"
  } - ${nonNoteItems.length} Item(s) - Total ${money(totalCreditAmount)}`;

  const dividerRow = "-".repeat(60);

  const textLines = [
    "Hello Credit Team,",
    "",
    "Please review the credit request details below.",
    "",
    `Customer Code(s): ${uniqueCustomers.join(", ") || "-"}`,
    "",
    `Invoice No(s): ${uniqueInvoices.join(", ") || "-"}`,
    `Total Requested Credit Amount: ${money(totalCreditAmount)}`,
    "",
    "SELECTED ITEMS",
    "",
    dividerRow,
    ...(displayRows.length > 0
      ? displayRows.flatMap(({ item, description, reason }, index) => [
          ...formatSelectedItemBlock({ item, description, reason }),
          ...(index < displayRows.length - 1 ? [""] : []),
        ])
      : ["No selected product rows found."]),
    dividerRow,
    "",
    ...(uploadedPhotos.some((photo) => Boolean(photo.publicUrl))
      ? [
          "Photo:",
          ...uploadedPhotos
            .filter((photo) => Boolean(photo.publicUrl))
            .map((photo) => photo.publicUrl),
          "",
        ]
      : [
          "No hosted photo links available.",
          "",
        ]),
    "Thank you.",
  ];

  return {
    subject,
    text: textLines.join("\n"),
  };
}

export function buildCreditRequestMailtoUrl({ subject, text }: { subject: string; text: string }) {
  const buildUrl = (body: string) =>
    `mailto:${CREDIT_REQUEST_RECIPIENT}?subject=${encodeMailtoValue(subject)}&body=${encodeMailtoValue(body)}`;
  return {
    url: buildUrl(text),
    isBodyTruncated: false,
  };
}

export { CREDIT_REQUEST_RECIPIENT };
