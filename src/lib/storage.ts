import { supabase } from "./supabase/client";

const BUCKET = "club-media";

// Carica un file su Storage e restituisce path + URL pubblico.
// Convenzione path: {club_id}/{area}/{timestamp}-{nomefile}
export async function uploadFile(
  clubId: string,
  area: string,
  file: File
): Promise<{ path: string; url: string }> {
  const sb = supabase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${clubId}/${area}/${Date.now()}-${safeName}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export function kindFromFile(file: File): "photo" | "video" | "document" {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}
