import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Session } from "next-auth";

type CartInsertPayload = {
  customer_code?: string;
  invoice_no?: string;
  item_no?: string;
  item_descp?: string;
  quantity?: number;
  sales_amount?: number;
  sales_batch_number?: string;
  sales_lot_no?: string;
  batch_expiration_date?: string;
  piece_price?: number;
  credit_type?: "case" | "piece";
  credit_amount?: number;
};

async function resolveUserId(session: Session): Promise<string | null> {
  const userId = session.user?.id;
  return userId ? String(userId) : null;
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

  const { data, error } = await supabaseAdmin
    .from("credit_request_cart_items")
    .select(
      "id,customer_code,invoice_no,item_no,item_descp,quantity,sales_amount,sales_batch_number,sales_lot_no,batch_expiration_date,piece_price,credit_type,credit_amount,created_at",
    )
    .eq("user_id", userId)
    .eq("salesperson", session.user.salespersonName)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch cart items", error);
    return Response.json({ error: "Failed to fetch cart items" }, { status: 500 });
  }

  return Response.json({ items: data ?? [] });
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

  const payload = (await request.json()) as CartInsertPayload;

  if (
    !payload.customer_code ||
    !payload.invoice_no ||
    !payload.item_no ||
    !payload.item_descp ||
    typeof payload.quantity !== "number" ||
    typeof payload.sales_amount !== "number" ||
    typeof payload.piece_price !== "number" ||
    !payload.credit_type ||
    typeof payload.credit_amount !== "number"
  ) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: conflictingCustomerRows, error: conflictingCustomerError } = await supabaseAdmin
    .from("credit_request_cart_items")
    .select("id")
    .eq("user_id", userId)
    .eq("salesperson", session.user.salespersonName)
    .neq("customer_code", payload.customer_code)
    .limit(1);

  if (conflictingCustomerError) {
    console.error("Failed to validate cart customer", conflictingCustomerError);
    return Response.json({ error: "Failed to validate cart customer" }, { status: 500 });
  }

  if ((conflictingCustomerRows ?? []).length > 0) {
    return Response.json(
      {
        error:
          "A credit request for another customer already exists in your cart. Please complete that request before adding items for a different customer.",
      },
      { status: 409 },
    );
  }

  const { error } = await supabaseAdmin.from("credit_request_cart_items").insert({
    user_id: userId,
    salesperson: session.user.salespersonName,
    customer_code: payload.customer_code,
    invoice_no: payload.invoice_no,
    item_no: payload.item_no,
    item_descp: payload.item_descp,
    quantity: payload.quantity,
    sales_amount: payload.sales_amount,
    sales_batch_number: payload.sales_batch_number ?? null,
    sales_lot_no: payload.sales_lot_no ?? null,
    batch_expiration_date: payload.batch_expiration_date ?? null,
    piece_price: payload.piece_price,
    credit_type: payload.credit_type,
    credit_amount: payload.credit_amount,
  });

  if (error) {
    console.error("Failed to add cart item", error);
    return Response.json(
      { error: "Failed to add cart item", details: error.message, code: error.code },
      { status: 500 },
    );
  }

  return Response.json({ ok: true }, { status: 201 });
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

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const supabaseAdmin = getSupabaseAdmin();

  if (id) {
    const { error } = await supabaseAdmin
      .from("credit_request_cart_items")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .eq("salesperson", session.user.salespersonName);

    if (error) {
      console.error("Failed to remove cart item", error);
      return Response.json({ error: "Failed to remove cart item" }, { status: 500 });
    }

    return Response.json({ ok: true });
  }

  const { error: clearItemsError } = await supabaseAdmin
    .from("credit_request_cart_items")
    .delete()
    .eq("user_id", userId)
    .eq("salesperson", session.user.salespersonName);

  if (clearItemsError) {
    console.error("Failed to clear cart items", clearItemsError);
    return Response.json({ error: "Failed to clear cart items" }, { status: 500 });
  }

  const { data: draft, error: draftLookupError } = await supabaseAdmin
    .from("credit_request_cart_drafts")
    .select("id")
    .eq("user_id", userId)
    .eq("salesperson", session.user.salespersonName)
    .maybeSingle();

  if (draftLookupError) {
    console.error("Failed to resolve cart draft for clear-all", draftLookupError);
    return Response.json({ error: "Failed to clear cart photos" }, { status: 500 });
  }

  if (draft?.id) {
    const { error: photoRowsDeleteError } = await supabaseAdmin
      .from("credit_request_photos")
      .update({ removed_from_cart_at: new Date().toISOString() })
      .eq("draft_id", draft.id);

    if (photoRowsDeleteError) {
      console.error("Failed to delete cart photo mappings during clear-all", photoRowsDeleteError);
      return Response.json({ error: "Failed to clear cart photos" }, { status: 500 });
    }
  }

  return Response.json({ ok: true });
}
