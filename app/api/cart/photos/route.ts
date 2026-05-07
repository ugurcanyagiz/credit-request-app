import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ensureCartDraftId, isMissingRemovedFromCartColumnError, listDraftPhotos, resolveUserId } from "@/lib/cart-draft";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSupabasePublicObjectUrl } from "@/lib/supabase-storage-url";

const PHOTO_BUCKET = process.env.SUPABASE_CART_PHOTOS_BUCKET || "credit-request-cart-photos";
const CART_PHOTO_FOLDER = "cart-photos";
const IMAGE_FILE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "tif",
  "tiff",
  "webp",
]);
const SOFT_DELETE_MIGRATION_HINT =
  "Database migration required: add removed_from_cart_at column to public.credit_request_photos.";

type PhotoResponse = {
  id: string;
  fileName: string;
  publicUrl: string;
  previewUrl: string;
  storagePath: string;
  createdAt: string;
};

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function isImageFile(file: File) {
  const mimeType = file.type.toLowerCase();
  const extension = getFileExtension(file.name);

  return mimeType.startsWith("image/") || IMAGE_FILE_EXTENSIONS.has(extension);
}

function resolveUploadContentType(file: File) {
  const mimeType = file.type.toLowerCase();
  if (mimeType.startsWith("image/")) {
    return mimeType;
  }

  const extension = getFileExtension(file.name);
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "gif") return "image/gif";
  if (extension === "avif") return "image/avif";
  if (extension === "bmp") return "image/bmp";
  if (extension === "tif" || extension === "tiff") return "image/tiff";

  return "image/jpeg";
}

function toPhotoResponse(photo: {
  id: string;
  file_name: string;
  public_url: string;
  storage_path: string;
  created_at: string;
}): PhotoResponse {
  return {
    id: photo.id,
    fileName: photo.file_name,
    publicUrl: photo.public_url,
    previewUrl: `/api/cart/photos/file?storagePath=${encodeURIComponent(photo.storage_path)}`,
    storagePath: photo.storage_path,
    createdAt: photo.created_at,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveUserId(session);
  if (!userId) {
    return Response.json({ error: "Unauthorized: missing user id in session" }, { status: 401 });
  }

  try {
    const draftId = await ensureCartDraftId({ userId, salesperson: session.user.salespersonName });
    const photos = await listDraftPhotos(draftId);
    return Response.json({ photos: photos.map((photo) => toPhotoResponse(photo)) });
  } catch (error) {
    console.error("Failed to load cart photos", error);
    return Response.json({ error: "Failed to fetch cart photos" }, { status: 500 });
  }
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
  const files = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File)
    .filter((file) => file.size > 0);

  if (files.length === 0) {
    return Response.json({ error: "No photos provided" }, { status: 400 });
  }

  try {
    const draftId = await ensureCartDraftId({ userId, salesperson: session.user.salespersonName });
    const supabaseAdmin = getSupabaseAdmin();
    const folder = `${userId}/${CART_PHOTO_FOLDER}/${draftId}`;
    const uploadedPhotos: PhotoResponse[] = [];

    for (const file of files) {
      if (!isImageFile(file)) {
        return Response.json({ error: `${file.name || "Selected file"} does not look like a photo.` }, { status: 400 });
      }

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "photo";
      const createdAt = new Date().toISOString();
      const safeTimestamp = createdAt.replace(/[:.]/g, "-");
      const storagePath = `${folder}/${safeTimestamp}-${randomUUID()}-${sanitizedName}`;
      const arrayBuffer = await file.arrayBuffer();

      const { error: uploadError } = await supabaseAdmin.storage
        .from(PHOTO_BUCKET)
        .upload(storagePath, arrayBuffer, { contentType: resolveUploadContentType(file), upsert: false });

      if (uploadError) {
        console.error("Failed to upload cart photo", uploadError);
        return Response.json(
          {
            error: "Failed to upload one or more photos.",
            details: uploadError.message,
          },
          { status: 500 },
        );
      }

      const publicUrl = buildSupabasePublicObjectUrl(PHOTO_BUCKET, storagePath);
      const insertPayload = {
        draft_id: draftId,
        file_name: file.name || sanitizedName,
        public_url: publicUrl,
        storage_path: storagePath,
      };
      let { data: insertedPhoto, error: insertError } = await supabaseAdmin
        .from("credit_request_photos")
        .insert({
          ...insertPayload,
          removed_from_cart_at: null,
        })
        .select("id,file_name,public_url,storage_path,created_at")
        .single();

      if (isMissingRemovedFromCartColumnError(insertError)) {
        const legacyInsertResult = await supabaseAdmin
          .from("credit_request_photos")
          .insert(insertPayload)
          .select("id,file_name,public_url,storage_path,created_at")
          .single();

        insertedPhoto = legacyInsertResult.data;
        insertError = legacyInsertResult.error;
      }

      if (insertError || !insertedPhoto) {
        console.error("Failed to persist cart photo mapping", insertError);
        await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([storagePath]);
        return Response.json({ error: "Failed to persist uploaded photo." }, { status: 500 });
      }

      uploadedPhotos.push(toPhotoResponse(insertedPhoto));
    }

    return Response.json({ photos: uploadedPhotos }, { status: 201 });
  } catch (error) {
    console.error("Failed to upload cart photos", error);
    return Response.json({ error: "Failed to upload cart photos" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveUserId(session);
  if (!userId) {
    return Response.json({ error: "Unauthorized: missing user id in session" }, { status: 401 });
  }

  const payload = (await request.json()) as { photoId?: string };
  if (!payload.photoId) {
    return Response.json({ error: "Missing photoId" }, { status: 400 });
  }

  try {
    const draftId = await ensureCartDraftId({ userId, salesperson: session.user.salespersonName });
    const supabaseAdmin = getSupabaseAdmin();

    const { data: existingPhoto, error: fetchError } = await supabaseAdmin
      .from("credit_request_photos")
      .select("id")
      .eq("id", payload.photoId)
      .eq("draft_id", draftId)
      .is("removed_from_cart_at", null)
      .single();

    if (fetchError || !existingPhoto) {
      return Response.json({ error: "Photo not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("credit_request_photos")
      .update({ removed_from_cart_at: new Date().toISOString() })
      .eq("id", existingPhoto.id)
      .eq("draft_id", draftId);

    if (deleteError) {
      if (isMissingRemovedFromCartColumnError(deleteError)) {
        return Response.json({ error: SOFT_DELETE_MIGRATION_HINT }, { status: 500 });
      }
      console.error("Failed to delete cart photo mapping", deleteError);
      return Response.json({ error: "Failed to delete cart photo" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete cart photo", error);
    return Response.json({ error: "Failed to delete cart photo" }, { status: 500 });
  }
}
