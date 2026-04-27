import { getServerSession } from "next-auth";

import {
  buildCreditRequestDraftText,
  buildCreditRequestMailtoUrl,
  CREDIT_REQUEST_RECIPIENT,
  type CreditRequestCartItem,
} from "@/lib/credit-request-email";
import { authOptions } from "@/lib/auth";
import { ensureCartDraftId, listDraftPhotos, resolveUserId } from "@/lib/cart-draft";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type PersistedPhotoRef = {
  fileName: string;
  publicUrl: string;
  storagePath: string;
};

type CustomerNameRow = {
  customer_name: string | null;
};

function extractCreditRequestNo(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value) && value.length > 0) {
    const [first] = value;
    if (typeof first === "string") {
      return first.trim();
    }

    if (first && typeof first === "object" && "get_next_credit_request_no" in first) {
      const raw = (first as { get_next_credit_request_no?: unknown }).get_next_credit_request_no;
      return typeof raw === "string" ? raw.trim() : "";
    }
  }

  if (value && typeof value === "object" && "get_next_credit_request_no" in value) {
    const raw = (value as { get_next_credit_request_no?: unknown }).get_next_credit_request_no;
    return typeof raw === "string" ? raw.trim() : "";
  }

  return "";
}

async function loadCustomerNameForDraft({
  salesperson,
  customerCode,
}: {
  salesperson: string;
  customerCode: string | null;
}) {
  if (!customerCode) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("credit_rows")
    .select("customer_name")
    .eq("salesperson", salesperson)
    .eq("customer_code", customerCode)
    .not("customer_name", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load customer name for draft", error);
    return null;
  }

  return (data as CustomerNameRow | null)?.customer_name ?? null;
}

function isValidCartItem(value: unknown): value is CreditRequestCartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<CreditRequestCartItem>;
  return (
    typeof item.id === "string" &&
    typeof item.customer_code === "string" &&
    typeof item.invoice_no === "string" &&
    typeof item.item_no === "string" &&
    typeof item.item_descp === "string" &&
    typeof item.quantity === "number" &&
    typeof item.sales_amount === "number" &&
    typeof item.piece_price === "number" &&
    (item.sales_batch_number === null || typeof item.sales_batch_number === "string") &&
    (item.sales_lot_no === null || typeof item.sales_lot_no === "string") &&
    (item.credit_type === "case" || item.credit_type === "piece") &&
    typeof item.credit_amount === "number" &&
    typeof item.created_at === "string"
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveUserId(session);
  if (!userId) {
    return Response.json({ error: "Unauthorized: missing user id in session" }, { status: 401 });
  }

  const formData = await request.formData();
  const cartRowsRaw = formData.get("cartRows");
  const creditRequestNoRaw = formData.get("creditRequestNo");
  const creditRequestNo =
    typeof creditRequestNoRaw === "string" && creditRequestNoRaw.trim().length > 0
      ? creditRequestNoRaw.trim()
      : null;

  if (typeof cartRowsRaw !== "string") {
    return Response.json({ error: "Missing cart rows payload" }, { status: 400 });
  }

  let cartRowsCandidate: unknown;

  try {
    cartRowsCandidate = JSON.parse(cartRowsRaw) as unknown;
  } catch {
    return Response.json({ error: "Invalid cart rows JSON" }, { status: 400 });
  }

  if (!Array.isArray(cartRowsCandidate) || cartRowsCandidate.length === 0) {
    return Response.json({ error: "No cart rows provided" }, { status: 400 });
  }

  if (!cartRowsCandidate.every((item) => isValidCartItem(item))) {
    return Response.json({ error: "Invalid cart row fields" }, { status: 400 });
  }

  try {
    const cartRows = cartRowsCandidate as CreditRequestCartItem[];
    const supabaseAdmin = getSupabaseAdmin();
    const { data: creditRequestNo, error: creditRequestNoError } = await supabaseAdmin.rpc(
      "get_next_credit_request_no",
    );

    if (creditRequestNoError) {
      console.error("Failed to generate credit request number", creditRequestNoError);
      return Response.json({ error: "Unable to generate Credit Request number. Please try again." }, { status: 500 });
    }

    const normalizedCreditRequestNo = extractCreditRequestNo(creditRequestNo);
    if (!normalizedCreditRequestNo) {
      console.error("Invalid credit request number RPC result", creditRequestNo);
      return Response.json({ error: "Unable to generate Credit Request number. Please try again." }, { status: 500 });
    }

    const draftId = await ensureCartDraftId({ userId, salesperson: session.user.salespersonName });
    const persistedPhotos = await listDraftPhotos(draftId);
    const customerName = await loadCustomerNameForDraft({
      salesperson: session.user.salespersonName,
      customerCode: cartRows[0]?.customer_code ?? null,
    });

    const uploadedPhotos: PersistedPhotoRef[] = persistedPhotos.map((photo) => ({
      fileName: photo.file_name,
      publicUrl: photo.public_url,
      storagePath: photo.storage_path,
    }));

    const draft = buildCreditRequestDraftText({
      cartRows,
      uploadedPhotos: uploadedPhotos.map((photo) => ({ fileName: photo.fileName, publicUrl: photo.publicUrl })),
      customerName,
    });
    const subject = `${normalizedCreditRequestNo} - ${draft.subject}`;
    const mailtoDraft = buildCreditRequestMailtoUrl({
      subject,
      text: draft.text,
    });

    return Response.json({
      ok: true,
      recipient: CREDIT_REQUEST_RECIPIENT,
      photos: uploadedPhotos,
      draft: {
        ...draft,
        subject,
      },
      mailtoUrl: mailtoDraft.url,
      isBodyTruncated: mailtoDraft.isBodyTruncated,
    });
  } catch (error) {
    console.error("Failed to prepare draft", error);
    return Response.json({ error: "Failed to prepare draft" }, { status: 500 });
  }
}
