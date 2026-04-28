import "server-only";

import type { Session } from "next-auth";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type PersistedCartPhoto = {
  id: string;
  file_name: string;
  public_url: string;
  storage_path: string;
  created_at: string;
  removed_from_cart_at: string | null;
};

type CartDraftRow = {
  id: string;
};

export async function resolveUserId(session: Session): Promise<string | null> {
  const userId = session.user?.id;
  return userId ? String(userId) : null;
}

export async function ensureCartDraftId({
  userId,
  salesperson,
}: {
  userId: string;
  salesperson: string;
}): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("credit_request_cart_drafts")
    .upsert(
      {
        user_id: userId,
        salesperson,
        updated_at: now,
        last_used_at: now,
      },
      { onConflict: "user_id,salesperson", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  const draftRow = data as CartDraftRow | null;
  if (error || !draftRow?.id) {
    throw new Error(`Unable to ensure cart draft: ${error?.message ?? "missing draft id"}`);
  }

  return draftRow.id;
}

export async function listDraftPhotos(draftId: string): Promise<PersistedCartPhoto[]> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("credit_request_photos")
    .select("id,file_name,public_url,storage_path,created_at,removed_from_cart_at")
    .eq("draft_id", draftId)
    .is("removed_from_cart_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load cart photos: ${error.message}`);
  }

  return (data as PersistedCartPhoto[] | null) ?? [];
}
