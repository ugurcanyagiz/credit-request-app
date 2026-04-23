import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Session } from "next-auth";

const PHOTO_BUCKET = process.env.SUPABASE_CART_PHOTOS_BUCKET || "credit-request-cart-photos";
const CART_PHOTO_FOLDER = "cart-photos";
const ACCEPTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 8;

type PhotoResponse = {
  fileName: string;
  publicUrl: string;
  storagePath: string;
  createdAt: string;
};

async function resolveUserId(session: Session): Promise<string | null> {
  const userId = session.user?.id;
  return userId ? String(userId) : null;
}

function toPhotoResponse(storagePath: string, createdAt: string): PhotoResponse {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
  const fileName = storagePath.split("/").at(-1) ?? storagePath;

  return {
    fileName,
    publicUrl: data.publicUrl,
    storagePath,
    createdAt,
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

  const supabaseAdmin = getSupabaseAdmin();
  const folder = `${userId}/${CART_PHOTO_FOLDER}`;

  const { data, error } = await supabaseAdmin.storage.from(PHOTO_BUCKET).list(folder, {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    console.error("Failed to list cart photos", error);
    return Response.json({ error: "Failed to fetch cart photos" }, { status: 500 });
  }

  const photos = (data ?? [])
    .filter((entry) => entry.name && !entry.name.endsWith("/"))
    .map((entry) => {
      const storagePath = `${folder}/${entry.name}`;
      return toPhotoResponse(storagePath, entry.created_at ?? new Date().toISOString());
    });

  return Response.json({ photos });
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

  if (files.length > MAX_FILES_PER_UPLOAD) {
    return Response.json({ error: `Too many files. Maximum is ${MAX_FILES_PER_UPLOAD}.` }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const folder = `${userId}/${CART_PHOTO_FOLDER}`;
  const uploadedPhotos: PhotoResponse[] = [];

  for (const file of files) {
    if (!ACCEPTED_IMAGE_MIME_TYPES.has(file.type)) {
      return Response.json({ error: `Unsupported file type for ${file.name}` }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: `${file.name} exceeds ${MAX_FILE_BYTES / (1024 * 1024)} MB limit` }, { status: 400 });
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const createdAt = new Date().toISOString();
    const storagePath = `${folder}/${createdAt}-${randomUUID()}-${sanitizedName}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

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

    uploadedPhotos.push(toPhotoResponse(storagePath, createdAt));
  }

  return Response.json({ photos: uploadedPhotos }, { status: 201 });
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

  const payload = (await request.json()) as { storagePath?: string };
  if (!payload.storagePath) {
    return Response.json({ error: "Missing storagePath" }, { status: 400 });
  }

  const userPrefix = `${userId}/${CART_PHOTO_FOLDER}/`;
  if (!payload.storagePath.startsWith(userPrefix)) {
    return Response.json({ error: "Forbidden storagePath" }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([payload.storagePath]);

  if (error) {
    console.error("Failed to delete cart photo", error);
    return Response.json({ error: "Failed to delete cart photo" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
