"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";

type CreditRow = {
  salesperson: string | null;
  customer_code: string | null;
  customer_name: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  item_no: string | null;
  item_descp: string | null;
  quantity: number | string | null;
  sales_amount: number | string | null;
};

type RowsResponse = {
  rows?: CreditRow[];
  error?: string;
};

type UploadResponse = {
  fileName?: string;
  rowsUploaded?: number;
  batches?: number;
  batchSize?: number;
  recognizedColumns?: string[];
  missingColumns?: string[];
  uploadedAt?: string;
  error?: string;
};

type UploadHistoryEntry = UploadResponse & {
  status: "success" | "error";
};

type AdminDashboardProps = {
  salespeople: string[];
};

function formatCell(value: CreditRow[keyof CreditRow]) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

function formatDateTime(value?: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminDashboard({ salespeople }: AdminDashboardProps) {
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>();
  const [rows, setRows] = useState<CreditRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [rowsErrorMessage, setRowsErrorMessage] = useState<string>();
  const [selectedFile, setSelectedFile] = useState<File>();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("Waiting for CSV file");
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string>();
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lastSuccessfulUpload = uploadHistory.find((entry) => entry.status === "success");
  const dashboardStats = useMemo(
    () => [
      { label: "Salespeople", value: salespeople.length.toLocaleString(), detail: "active names from credit_rows" },
      { label: "Loaded rows", value: rows.length.toLocaleString(), detail: selectedSalesperson ? selectedSalesperson : "select a salesperson" },
      {
        label: "Last upload",
        value: lastSuccessfulUpload?.rowsUploaded?.toLocaleString() ?? "—",
        detail: lastSuccessfulUpload?.fileName ?? "no upload in this session",
      },
    ],
    [lastSuccessfulUpload?.fileName, lastSuccessfulUpload?.rowsUploaded, rows.length, salespeople.length, selectedSalesperson],
  );

  async function loadSalespersonRows(salesperson: string) {
    setSelectedSalesperson(salesperson);
    setRows([]);
    setRowsErrorMessage(undefined);
    setIsLoadingRows(true);

    const response = await fetch(`/api/admin/salesperson-credit-rows?salesperson=${encodeURIComponent(salesperson)}`);
    const payload = (await response.json()) as RowsResponse;

    if (!response.ok) {
      setRowsErrorMessage(payload.error ?? "Failed to load salesperson credit rows.");
      setIsLoadingRows(false);
      return;
    }

    setRows(payload.rows ?? []);
    setIsLoadingRows(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFile(file);
    setUploadErrorMessage(undefined);
    setUploadProgressText(file ? `${file.name} selected` : "Waiting for CSV file");
  }

  async function uploadCsv() {
    if (!selectedFile || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadErrorMessage(undefined);
    setUploadProgressText("Reading and transforming CSV...");

    const formData = new FormData();
    formData.append("file", selectedFile);

    const response = await fetch("/api/admin/credit-rows-upload", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as UploadResponse;

    if (!response.ok) {
      const error = payload.error ?? "Upload failed.";
      setUploadErrorMessage(error);
      setUploadProgressText("Upload failed");
      setUploadHistory((history) => [{ ...payload, fileName: selectedFile.name, status: "error", uploadedAt: new Date().toISOString() }, ...history]);
      setIsUploading(false);
      return;
    }

    setUploadProgressText(`Completed: ${payload.rowsUploaded?.toLocaleString() ?? 0} rows uploaded`);
    setUploadHistory((history) => [{ ...payload, status: "success" }, ...history]);
    setSelectedFile(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsUploading(false);
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 text-white shadow-2xl shadow-slate-300/60 dark:border-slate-800 dark:shadow-black/30">
        <div className="relative p-6 sm:p-8">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="absolute bottom-0 left-20 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Admin Control Center
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Credit rows upload and review dashboard</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Upload CSV files directly to Supabase credit_rows with the same column aliases, null-filling, quantity parsing, and batch insert flow from the desktop uploader.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last success</p>
              <p className="mt-2 font-semibold text-white">{lastSuccessfulUpload?.fileName ?? "No upload yet"}</p>
              <p className="mt-1 text-slate-300">{formatDateTime(lastSuccessfulUpload?.uploadedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {dashboardStats.map((stat) => (
          <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{stat.value}</p>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{stat.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">CSV uploader</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select a CSV file and send it to credit_rows in batches.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${isUploading ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>
              {isUploading ? "Uploading" : "Ready"}
            </span>
          </div>

          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-500 dark:hover:bg-blue-950/30">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFileChange} />
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white">↑</span>
            <span className="mt-4 text-sm font-semibold text-slate-950 dark:text-white">{selectedFile?.name ?? "Choose CSV file"}</span>
            <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recognized headers are mapped automatically; missing columns are sent as null.</span>
          </label>

          <button
            type="button"
            onClick={uploadCsv}
            disabled={!selectedFile || isUploading}
            className="mt-5 w-full rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-800"
          >
            {isUploading ? "Uploading to Supabase..." : "Upload to Supabase"}
          </button>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Activity</p>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{uploadProgressText}</p>
            {uploadErrorMessage ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadErrorMessage}</p> : null}
          </div>

          {uploadHistory.length > 0 ? (
            <div className="mt-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-950 dark:text-white">Session upload history</h4>
              {uploadHistory.slice(0, 4).map((entry, index) => (
                <div key={`${entry.fileName}-${entry.uploadedAt}-${index}`} className="rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{entry.fileName}</p>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${entry.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {entry.status === "success" ? `${entry.rowsUploaded} rows • ${entry.batches} batches` : entry.error} • {formatDateTime(entry.uploadedAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">Salesperson data explorer</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Load up to 500 rows for a salesperson after upload.</p>
            </div>
            <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">{isLoadingRows ? "Loading" : `${rows.length} rows`}</p>
          </div>

          <div className="mt-5 flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/70">
            {salespeople.map((salesperson) => {
              const isSelected = salesperson === selectedSalesperson;

              return (
                <button
                  key={salesperson}
                  type="button"
                  onClick={() => loadSalespersonRows(salesperson)}
                  disabled={isLoadingRows && isSelected}
                  className={`rounded-full border px-3 py-2 text-xs font-bold transition disabled:cursor-wait disabled:opacity-70 ${
                    isSelected
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  }`}
                >
                  {isLoadingRows && isSelected ? "Loading..." : salesperson}
                </button>
              );
            })}
            {salespeople.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No salesperson data found.</p> : null}
          </div>

          {rowsErrorMessage ? <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{rowsErrorMessage}</p> : null}

          {!rowsErrorMessage && !isLoadingRows && rows.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              {selectedSalesperson ? "No rows found for this salesperson." : "Select a salesperson to preview credit rows."}
            </div>
          ) : null}

          {!rowsErrorMessage && rows.length > 0 ? (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    {[
                      "Customer Code",
                      "Customer",
                      "Invoice",
                      "Invoice Date",
                      "Item No",
                      "Item Description",
                      "Qty",
                      "Sales Amount",
                    ].map((header) => (
                      <th key={header} scope="col" className="whitespace-nowrap px-3 py-3 font-bold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {rows.map((row, index) => (
                    <tr key={`${row.invoice_no}-${row.item_no}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                      <td className="whitespace-nowrap px-3 py-3 font-semibold">{formatCell(row.customer_code)}</td>
                      <td className="min-w-52 px-3 py-3">{formatCell(row.customer_name)}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatCell(row.invoice_no)}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatCell(row.invoice_date)}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatCell(row.item_no)}</td>
                      <td className="min-w-64 px-3 py-3">{formatCell(row.item_descp)}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatCell(row.quantity)}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatCell(row.sales_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
