export function getSupabasePublicBaseUrl() {
  const publicSupabaseUrl = process.env.SUPABASE_PUBLIC_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!publicSupabaseUrl) {
    throw new Error("Missing SUPABASE_PUBLIC_URL or NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  return publicSupabaseUrl.replace(/\/+$/, "");
}

export function buildSupabasePublicObjectUrl(bucket: string, storagePath: string) {
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${getSupabasePublicBaseUrl()}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
}
