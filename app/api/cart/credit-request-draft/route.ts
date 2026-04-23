import { getServerSession } from "next-auth";

import {
  buildCreditRequestDraftText,
  buildCreditRequestMailtoUrl,
  CREDIT_REQUEST_RECIPIENT,
  type CreditRequestCartItem,
} from "@/lib/credit-request-email";
import { authOptions } from "@/lib/auth";
import { ensureCartDraftId, listDraftPhotos, resolveUserId } from "@/lib/cart-draft";

type PersistedPhotoRef = {
  fileName: string;
  publicUrl: string;
  storagePath: string;
};

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
    const draftId = await ensureCartDraftId({ userId, salesperson: session.user.salespersonName });
    const persistedPhotos = await listDraftPhotos(draftId);

    const uploadedPhotos: PersistedPhotoRef[] = persistedPhotos.map((photo) => ({
      fileName: photo.file_name,
      publicUrl: photo.public_url,
      storagePath: photo.storage_path,
    }));

    const draft = buildCreditRequestDraftText({
      cartRows: cartRowsCandidate as CreditRequestCartItem[],
      uploadedPhotos: uploadedPhotos.map((photo) => ({ fileName: photo.fileName, publicUrl: photo.publicUrl })),
    });
    const mailtoDraft = buildCreditRequestMailtoUrl({
      subject: draft.subject,
      text: draft.text,
    });

    return Response.json({
      ok: true,
      recipient: CREDIT_REQUEST_RECIPIENT,
      photos: uploadedPhotos,
      draft,
      mailtoUrl: mailtoDraft.url,
      isBodyTruncated: mailtoDraft.isBodyTruncated,
    });
  } catch (error) {
    console.error("Failed to prepare draft", error);
    return Response.json({ error: "Failed to prepare draft" }, { status: 500 });
  }
}
