import { AuthClient } from "@supabase/auth-js";

// Supabase is used for GitHub sign-in, storing user preferences (as user metadata),
// and hosting the images that users paste/drop into their gists. Since that only needs
// its auth and storage APIs, the app uses its auth client directly (rather than the full
// Supabase client, which includes realtime and database clients).

const SUPABASE_URL = "https://upnfachynwuwialgybvf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwbmZhY2h5bnd1d2lhbGd5YnZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NTIwMTEsImV4cCI6MjA1NDAyODAxMX0.NcXDxrek4MiJ1rUfonxX7J0qT-1OB5i4MX-mFN64iFI";

/** The auth client, which is configured the same way as the full Supabase client (so existing sessions are kept). */
export const auth = new AuthClient({
  url: `${SUPABASE_URL}/auth/v1`,
  headers: {
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    apikey: SUPABASE_PUBLISHABLE_KEY,
  },
  storageKey: "sb-upnfachynwuwialgybvf-auth-token",
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: "implicit",
});

const ASSETS_URL = `${SUPABASE_URL}/storage/v1/object`;

/** Uploads an image to the "assets" storage bucket, and returns its public URL. */
export async function uploadImage(gistId: string, image: File | ArrayBuffer): Promise<string> {
  const path = `assets/${gistId}/${crypto.randomUUID()}.png`;
  const { data } = await auth.getSession();

  const response = await fetch(`${ASSETS_URL}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${data.session?.access_token ?? SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": (image instanceof File && image.type) || "image/png",
      "Cache-Control": "max-age=3600",
    },
    body: image,
  });

  if (!response.ok) throw new Error(`Failed to upload image (${response.status})`);
  return `${ASSETS_URL}/public/${path}`;
}
