"use client";

import { useMemo, useState } from "react";

type CreditMemoRow = {
  customer_code: string;
  customer_name: string;
  credit_memo_no: string;
  credit_memo_date: string;
  item_no: string;
  item_descp: string;
  quantity: number;
  sales_amount: number;
  piece_price: number;
  salesperson: string | null;
  bp_email: string | null;
};

type Props = {
  rows: CreditMemoRow[];
};

export function CreditMemosBrowser({ rows }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMemoNo, setSelectedMemoNo] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.customer_code.toLocaleLowerCase().includes(q) ||
      row.customer_name.toLocaleLowerCase().includes(q) ||
      row.credit_memo_no.toLocaleLowerCase().includes(q) ||
      row.item_no.toLocaleLowerCase().includes(q),
    );
  }, [rows, searchTerm]);

  const customerGroups = useMemo(() => {
    const map = new Map<string, { customerCode: string; customerName: string; memoNos: string[] }>();

    for (const row of filteredRows) {
      const key = row.customer_code;
      if (!map.has(key)) {
        map.set(key, { customerCode: row.customer_code, customerName: row.customer_name, memoNos: [] });
      }
      const group = map.get(key);
      if (group && !group.memoNos.includes(row.credit_memo_no)) {
        group.memoNos.push(row.credit_memo_no);
      }
    }

    return Array.from(map.values());
  }, [filteredRows]);

  const effectiveSelectedMemoNo =
    selectedMemoNo && filteredRows.some((row) => row.credit_memo_no === selectedMemoNo)
      ? selectedMemoNo
      : customerGroups[0]?.memoNos[0] ?? null;

  const selectedMemoRows = useMemo(
    () => filteredRows.filter((row) => row.credit_memo_no === effectiveSelectedMemoNo),
    [filteredRows, effectiveSelectedMemoNo],
  );

  const memoMeta = selectedMemoRows[0] ?? null;

  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Credit Memos</h2>
      <p className="mt-1 text-sm text-zinc-600">Browse by customer, then open a credit memo to inspect item-level rows.</p>

      <div className="mt-4">
        <label htmlFor="credit-memo-search" className="mb-1 block text-sm font-medium text-zinc-700">Search</label>
        <input id="credit-memo-search" type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Customer code, customer name, credit memo no, or item no" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(250px,1fr)_2fr]">
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-zinc-200 bg-white">
          <ul className="divide-y divide-zinc-200">
            {customerGroups.map((customer) => (
              <li key={customer.customerCode} className="p-3">
                <p className="font-medium text-zinc-900">{customer.customerCode}</p>
                <p className="mb-2 text-sm text-zinc-600">{customer.customerName}</p>
                <div className="flex flex-wrap gap-2">
                  {customer.memoNos.map((memoNo) => (
                    <button key={memoNo} type="button" onClick={() => setSelectedMemoNo(memoNo)} className={`rounded-md border px-2 py-1 text-xs transition ${effectiveSelectedMemoNo === memoNo ? "border-zinc-700 bg-zinc-800 text-white" : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"}`}>
                      {memoNo}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          {memoMeta ? (
            <>
              <div className="mb-3 grid gap-1 border-b border-zinc-200 pb-3 text-sm text-zinc-700 md:grid-cols-2">
                <p><span className="font-medium text-zinc-900">Credit Memo No:</span> {memoMeta.credit_memo_no}</p>
                <p><span className="font-medium text-zinc-900">Date:</span> {memoMeta.credit_memo_date}</p>
                <p><span className="font-medium text-zinc-900">Salesperson:</span> {memoMeta.salesperson ?? "-"}</p>
                <p><span className="font-medium text-zinc-900">BP Email:</span> {memoMeta.bp_email ?? "-"}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Item No</th>
                      <th className="px-3 py-2 font-medium">Item Description</th>
                      <th className="px-3 py-2 font-medium">Quantity</th>
                      <th className="px-3 py-2 font-medium">Sales Amount</th>
                      <th className="px-3 py-2 font-medium">Piece Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMemoRows.map((row, index) => (
                      <tr key={`${row.credit_memo_no}-${row.item_no}-${index}`} className="border-t border-zinc-200">
                        <td className="px-3 py-2">{row.item_no}</td>
                        <td className="px-3 py-2">{row.item_descp}</td>
                        <td className="px-3 py-2">{row.quantity}</td>
                        <td className="px-3 py-2">{row.sales_amount}</td>
                        <td className="px-3 py-2">{row.piece_price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-600">No credit memo rows found for this filter.</p>
          )}
        </div>
      </div>
    </section>
  );
}
