import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

type CartItemPayload = {
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
  credit_type: "case" | "piece";
  credit_amount: number;
};

type AttachmentPayload = {
  filename: string;
  contentType: string;
  base64Data: string;
};

type SendCreditRequestPayload = {
  items?: CartItemPayload[];
  attachments?: AttachmentPayload[];
};

const RECIPIENT = "credit@turkanafood.com";

export const runtime = "nodejs";

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

function buildEmailHtml({
  items,
  salespersonName,
}: {
  items: CartItemPayload[];
  salespersonName: string;
}) {
  const uniqueCustomers = [...new Set(items.map((item) => item.customer_code))];
  const uniqueInvoices = [...new Set(items.map((item) => item.invoice_no))];
  const notes = items
    .filter((item) => item.item_descp.includes("Reason:"))
    .map((item) => item.item_descp.replace("Reason:", "").trim())
    .filter(Boolean);

  const totalAmount = items.reduce((sum, item) => sum + Number(item.credit_amount || 0), 0);

  const rowsHtml = items
    .map((item) => {
      return [
        "<tr>",
        `<td style=\"border:1px solid #cbd5e1;padding:8px;text-align:center;\">${escapeHtml(item.item_no)}</td>`,
        `<td style=\"border:1px solid #cbd5e1;padding:8px;\">${escapeHtml(item.item_descp)}</td>`,
        `<td style=\"border:1px solid #cbd5e1;padding:8px;text-align:center;\">${escapeHtml(item.invoice_no)}</td>`,
        `<td style=\"border:1px solid #cbd5e1;padding:8px;text-align:right;\">${escapeHtml(String(item.quantity ?? 0))}</td>`,
        `<td style=\"border:1px solid #cbd5e1;padding:8px;text-align:right;\">${escapeHtml(money(item.sales_amount))}</td>`,
        `<td style=\"border:1px solid #cbd5e1;padding:8px;text-align:right;\">${escapeHtml(money(item.piece_price))}</td>`,
        `<td style=\"border:1px solid #cbd5e1;padding:8px;text-align:center;\">${escapeHtml(item.customer_code)}</td>`,
        `<td style=\"border:1px solid #cbd5e1;padding:8px;text-align:center;\">${escapeHtml(item.credit_type)}</td>`,
        `<td style=\"border:1px solid #cbd5e1;padding:8px;text-align:right;\">${escapeHtml(money(item.credit_amount))}</td>`,
        "</tr>",
      ].join("");
    })
    .join("");

  const notesHtml =
    notes.length > 0
      ? `<div style=\"margin-top:18px;\"><p style=\"margin:0 0 8px;font-weight:600;color:#0f172a;\">Notes / Comments</p><ul style=\"margin:0;padding-left:20px;color:#334155;\">${notes.map((note) => `<li style=\"margin-bottom:6px;\">${escapeHtml(note)}</li>`).join("")}</ul></div>`
      : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:980px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;">
      <tr>
        <td style="padding:24px 24px 8px;">
          <h2 style="margin:0 0 8px;font-size:20px;">Credit Request Submission</h2>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.5;">Hello Team,</p>
          <p style="margin:6px 0 0;color:#475569;font-size:14px;line-height:1.5;">Please review the credit request details submitted by <strong>${escapeHtml(salespersonName)}</strong>.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f1f5f9;"><strong>Customers</strong></td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(uniqueCustomers.join(", "))}</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f1f5f9;"><strong>Invoices</strong></td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(uniqueInvoices.join(", "))}</td>
            </tr>
            <tr>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f1f5f9;"><strong>Total Rows</strong></td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;">${items.length}</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f1f5f9;"><strong>Total Credit Amount</strong></td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(money(totalAmount))}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr>
                <th style="border:1px solid #94a3b8;background:#e2e8f0;padding:8px;text-align:center;">Item No</th>
                <th style="border:1px solid #94a3b8;background:#e2e8f0;padding:8px;text-align:left;">Item Description</th>
                <th style="border:1px solid #94a3b8;background:#e2e8f0;padding:8px;text-align:center;">Invoice No</th>
                <th style="border:1px solid #94a3b8;background:#e2e8f0;padding:8px;text-align:right;">Quantity</th>
                <th style="border:1px solid #94a3b8;background:#e2e8f0;padding:8px;text-align:right;">Sales Amount</th>
                <th style="border:1px solid #94a3b8;background:#e2e8f0;padding:8px;text-align:right;">Piece Price</th>
                <th style="border:1px solid #94a3b8;background:#e2e8f0;padding:8px;text-align:center;">Customer Code</th>
                <th style="border:1px solid #94a3b8;background:#e2e8f0;padding:8px;text-align:center;">Credit Type</th>
                <th style="border:1px solid #94a3b8;background:#e2e8f0;padding:8px;text-align:right;">Credit Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          ${notesHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function isValidAttachment(attachment: AttachmentPayload) {
  if (!attachment.filename || !attachment.contentType || !attachment.base64Data) {
    return false;
  }

  const estimatedBytes = Math.ceil((attachment.base64Data.length * 3) / 4);
  return estimatedBytes <= 5 * 1024 * 1024;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as SendCreditRequestPayload;
  const items = Array.isArray(body.items) ? body.items : [];
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  if (items.length === 0) {
    return Response.json({ error: "Cart is empty." }, { status: 400 });
  }

  if (attachments.some((attachment) => !isValidAttachment(attachment))) {
    return Response.json(
      { error: "Each attachment must include filename/contentType/data and be 5MB or smaller." },
      { status: 400 },
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.CREDIT_REQUEST_FROM_EMAIL;

  if (!resendApiKey || !senderEmail) {
    return Response.json(
      { error: "Email provider is not configured. Missing RESEND_API_KEY or CREDIT_REQUEST_FROM_EMAIL." },
      { status: 500 },
    );
  }

  const emailHtml = buildEmailHtml({
    items,
    salespersonName: session.user.salespersonName,
  });

  const subject = `Credit Request - ${session.user.salespersonName} - ${new Date().toISOString().slice(0, 10)}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: senderEmail,
      to: [RECIPIENT],
      subject,
      html: emailHtml,
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.base64Data,
        type: attachment.contentType,
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to send credit request email", errorText);
    return Response.json({ error: "Failed to send credit request email." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
