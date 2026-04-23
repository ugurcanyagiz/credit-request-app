import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Session } from "next-auth";

const PHOTO_BUCKET = process.env.SUPABASE_CART_PHOTOS_BUCKET || "credit-request-cart-photos";
const CART_PHOTO_FOLDER = "cart-photos";

async function resolveUserId(session: Session): Promise<string | null> {
  const userId = session.user?.id;
  return userId ? String(userId) : null;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveUserId(session);
  if (!userId) {
    return Response.json({ error: "Unauthorized: missing user id in session" }, { status: 401 });
  }

  const url = new URL(request.url);
  const storagePath = url.searchParams.get("storagePath");
  if (!storagePath) {
    return Response.json({ error: "Missing storagePath" }, { status: 400 });
  }

  const userPrefix = `${userId}/${CART_PHOTO_FOLDER}/`;
  if (!storagePath.startsWith(userPrefix)) {
    return Response.json({ error: "Forbidden storagePath" }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage.from(PHOTO_BUCKET).download(storagePath);

  if (error || !data) {
    console.error("Failed to download cart photo", error);
    return Response.json({ error: "Failed to fetch cart photo" }, { status: 404 });
  }

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=300",
    },
  });
}
