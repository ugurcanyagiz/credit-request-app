export const CREDIT_ROW_COLUMNS = [
  "item_no",
  "item_descp",
  "customer_code",
  "customer_name",
  "salesperson",
  "invoice_no",
  "invoice_date",
  "quantity",
  "sales_amount",
  "sales_batch_number",
  "sales_lot_no",
  "batch_expiration_date",
  "piece_price",
  "bp_email",
  "free_txt",
] as const;

export type CreditRowColumn = (typeof CREDIT_ROW_COLUMNS)[number];
export type CreditUploadRecord = Record<CreditRowColumn, string | number | null>;

const COLUMN_ALIASES: Record<string, CreditRowColumn> = {
  "item no": "item_no",
  item_no: "item_no",
  "item code": "item_no",
  "item descp": "item_descp",
  item_descp: "item_descp",
  description: "item_descp",
  "customer code": "customer_code",
  customer_code: "customer_code",
  "customer no": "customer_code",
  "customer name": "customer_name",
  customer_name: "customer_name",
  salesperson: "salesperson",
  "invoice no": "invoice_no",
  invoice_no: "invoice_no",
  "invoice #": "invoice_no",
  "invoice date": "invoice_date",
  invoice_date: "invoice_date",
  quantity: "quantity",
  qty: "quantity",
  "sales amount": "sales_amount",
  sales_amount: "sales_amount",
  "sales batch number": "sales_batch_number",
  sales_batch_number: "sales_batch_number",
  "sales lot no": "sales_lot_no",
  sales_lot_no: "sales_lot_no",
  "batch expiration date": "batch_expiration_date",
  batch_expiration_date: "batch_expiration_date",
  "piece price": "piece_price",
  piece_price: "piece_price",
  "bp email": "bp_email",
  bp_email: "bp_email",
  email: "bp_email",
  "free txt": "free_txt",
  free_txt: "free_txt",
};

export type TransformResult = {
  records: CreditUploadRecord[];
  recognizedColumns: string[];
  missingColumns: CreditRowColumn[];
};

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replaceAll("_", " ").split(/\s+/).filter(Boolean).join(" ");
}

function cleanValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function parseNumericText(value: string | undefined) {
  const cleaned = cleanValue(value);

  if (cleaned === null) {
    return null;
  }

  const parsed = Number(cleaned.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : cleaned;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  if (inQuotes) {
    throw new Error("CSV has an unclosed quoted field.");
  }

  return rows;
}

export function transformCsv(csvText: string): TransformResult {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));

  if (rows.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const headers = rows[0];
  const columnMap = new Map<number, CreditRowColumn>();
  const recognizedColumns: string[] = [];

  headers.forEach((header, index) => {
    const mappedColumn = COLUMN_ALIASES[normalizeHeader(header)];

    if (mappedColumn) {
      columnMap.set(index, mappedColumn);
      recognizedColumns.push(header.trim());
    }
  });

  if (columnMap.size === 0) {
    throw new Error("No recognized CSV headers found for credit_rows. Please check your CSV column names.");
  }

  const mappedColumns = new Set(columnMap.values());
  const missingColumns = CREDIT_ROW_COLUMNS.filter((column) => !mappedColumns.has(column));
  const records: CreditUploadRecord[] = [];

  for (const values of rows.slice(1)) {
    const record = Object.fromEntries(CREDIT_ROW_COLUMNS.map((column) => [column, null])) as CreditUploadRecord;

    columnMap.forEach((column, index) => {
      record[column] = column === "quantity" ? parseNumericText(values[index]) : cleanValue(values[index]);
    });

    if (Object.values(record).some((value) => value !== null)) {
      records.push(record);
    }
  }

  if (records.length === 0) {
    throw new Error("No valid rows found after cleaning.");
  }

  return { records, recognizedColumns, missingColumns };
}

export function chunkRecords<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}
