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

  const tabDelimitedHeader = ["Customer Code", "Invoice No", "Item No", "Description", "Reason", "Qty", "Amount"].join(
    "\t",
  );
  const tabDelimitedRows =
    displayRows.length > 0
      ? displayRows.map(({ item, description, reason }) =>
          [
            compactText(item.customer_code || "-", 32),
            compactText(item.invoice_no || "-", 32),
            compactText(item.item_no || "-", 32),
            compactText(description, 72),
            compactText(reason || "-", 48),
            String(item.quantity ?? 0),
            money(Number(item.credit_amount ?? 0)),
          ].join("\t"),
        )
      : ["No selected product rows found."];

  const textLines = [
    "Hello Credit Team,",
    "",
    "Please review the credit request details below.",
    "",
    tabDelimitedHeader,
    ...tabDelimitedRows,
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
