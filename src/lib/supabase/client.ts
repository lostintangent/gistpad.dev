import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://upnfachynwuwialgybvf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwbmZhY2h5bnd1d2lhbGd5YnZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NTIwMTEsImV4cCI6MjA1NDAyODAxMX0.NcXDxrek4MiJ1rUfonxX7J0qT-1OB5i4MX-mFN64iFI";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export async function uploadImage(
  gistId: string,
  file: File | ArrayBuffer
): Promise<string> {
  const fileName = `${Math.random().toString(36).substring(7)}.png`;
  const { data, error } = await supabase.storage
    .from("assets")
    .upload(`${gistId}/${fileName}`, file);

  if (error) {
    throw error;
  }

  const { data: publicUrl } = supabase.storage
    .from("assets")
    .getPublicUrl(`${gistId}/${fileName}`);

  return publicUrl.publicUrl;
}
