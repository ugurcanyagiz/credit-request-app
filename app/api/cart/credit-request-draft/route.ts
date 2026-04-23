import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";

import { buildCreditRequestDraft, type CreditRequestCartItem } from "@/lib/credit-request-email";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Session } from "next-auth";

const PHOTO_BUCKET = process.env.SUPABASE_CART_PHOTOS_BUCKET || "credit-request-cart-photos";
const ACCEPTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 8;

async function resolveUserId(session: Session): Promise<string | null> {
  const userId = session.user?.id;
  return userId ? String(userId) : null;
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

  const cartRows = cartRowsCandidate as CreditRequestCartItem[];

  const imageFiles = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File)
    .filter((file) => file.size > 0);

  if (imageFiles.length > MAX_FILES) {
    return Response.json({ error: `Too many files. Maximum is ${MAX_FILES}.` }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const timestampFolder = new Date().toISOString().slice(0, 10);
  const uploadPrefix = `${userId}/${timestampFolder}`;

  const uploadedPhotos: Array<{ fileName: string; publicUrl: string; storagePath: string }> = [];

  for (const file of imageFiles) {
    if (!ACCEPTED_IMAGE_MIME_TYPES.has(file.type)) {
      return Response.json({ error: `Unsupported file type for ${file.name}` }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: `${file.name} exceeds ${MAX_FILE_BYTES / (1024 * 1024)} MB limit` }, { status: 400 });
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${uploadPrefix}/${randomUUID()}-${sanitizedName}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Failed to upload credit request photo", uploadError);
      return Response.json(
        {
          error: "Failed to upload one or more photos.",
          details: uploadError.message,
        },
        { status: 500 },
      );
    }

    const { data } = supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);

    uploadedPhotos.push({
      fileName: file.name,
      publicUrl: data.publicUrl,
      storagePath,
    });
  }

  const draft = buildCreditRequestDraft({
    cartRows,
    uploadedPhotos: uploadedPhotos.map((photo) => ({ fileName: photo.fileName, publicUrl: photo.publicUrl })),
  });

  return Response.json({
    ok: true,
    bucket: PHOTO_BUCKET,
    photos: uploadedPhotos,
    draft,
  });
}
