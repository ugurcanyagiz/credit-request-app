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

function isStandaloneReasonRow(itemDescription: string) {
  return itemDescription.trim().startsWith("Reason:");
}

function parseReasonAndDescription(itemDescription: string) {
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

function toReasonRowKey(item: CreditRequestCartItem) {
  return `${item.customer_code}::${item.invoice_no}::${item.item_no}`;
}

type TableAlignment = "left" | "right";

function toTableCell(value: string, width: number, alignment: TableAlignment) {
  const normalizedValue = truncate(value, width).replace(/\s+/g, " ");
  return alignment === "right"
    ? normalizedValue.padStart(width, " ")
    : normalizedValue.padEnd(width, " ");
}

function toTableRow(columns: string[], widths: number[], alignments: TableAlignment[]) {
  return columns
    .map((value, index) => toTableCell(value, widths[index], alignments[index]))
    .join("  ");
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

  const rowWidths = [15, 15, 15, 35, 15, 25, 30, 15, 10, 15] as const;
  const rowAlignments: TableAlignment[] = [
    "left",
    "left",
    "left",
    "left",
    "left",
    "left",
    "left",
    "left",
    "right",
    "right",
  ];
  const headerRow = toTableRow(
    [
      "C.Code",
      "Invoice",
      "Item",
      "Item Description",
      "Batch",
      "Lot",
      "Reason",
      "Type",
      "Qty",
      "Amount",
    ],
    [...rowWidths],
    rowAlignments,
  );
  const tableWidth = headerRow.length;
  const dividerRow = "-".repeat(tableWidth);

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
    dividerRow,
    headerRow,
    dividerRow,
    ...(displayRows.length > 0
      ? displayRows.map(({ item, description, reason }) =>
          toTableRow(
            [
              item.customer_code || "-",
              item.invoice_no || "-",
              item.item_no || "-",
              description,
              item.sales_batch_number || "-",
              item.sales_lot_no || "-",
              reason,
              item.credit_type || "-",
              String(item.quantity ?? 0),
              money(Number(item.credit_amount ?? 0)),
            ],
            [...rowWidths],
            rowAlignments,
          ),
        )
      : ["No selected product rows found."]),
    dividerRow,
    "",
    ...(uploadedPhotos.some((photo) => Boolean(photo.publicUrl))
      ? [
          ...uploadedPhotos
            .filter((photo) => Boolean(photo.publicUrl))
            .flatMap((photo, index) => [
              `Photo ${index + 1}:`,
              photo.publicUrl,
              "",
            ]),
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

const MAX_MAILTO_URL_LENGTH = 1800;

export function buildCreditRequestMailtoUrl({ subject, text }: { subject: string; text: string }) {
  const buildUrl = (body: string) =>
    `mailto:${CREDIT_REQUEST_RECIPIENT}?subject=${encodeMailtoValue(subject)}&body=${encodeMailtoValue(body)}`;

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
