import Link from "next/link";

type CreditMemoSummary = {
  credit_memo_no: string;
  credit_memo_date: string;
};

type CustomerCreditMemosViewProps = {
  customerCode: string;
  creditMemos: CreditMemoSummary[];
};

export function CustomerCreditMemosView({ customerCode, creditMemos }: CustomerCreditMemosViewProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Credit Memos</h2>

      {creditMemos.length > 0 ? (
        <ul className="space-y-2">
          {creditMemos.map((memo) => (
            <li key={memo.credit_memo_no} className="rounded-md border border-zinc-200 text-sm">
              <Link
                href={`/dashboard/customers/${encodeURIComponent(customerCode)}/credit-memos/${encodeURIComponent(memo.credit_memo_no)}`}
                className="block px-3 py-2 transition-colors hover:bg-zinc-50"
              >
                <p className="font-medium">Credit Memo: {memo.credit_memo_no}</p>
                <p className="text-zinc-600">Credit Date: {memo.credit_memo_date}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No credit memo records found for this customer.</p>
      )}
    </section>
  );
}
