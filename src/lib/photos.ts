import { ensureVisitor, sb } from "./supabase";
import type { AreaPhoto } from "./types";

const BUCKET = "area-photos";
const COLUMNS = "id, area_id, path, author, dev, width, height, position, approved, created_at";
const MAX_SIDE = 1920; // Long side after shrinking, in pixels

interface Row {
  id: string;
  area_id: string;
  path: string;
  author: string;
  dev: boolean;
  width: number;
  height: number;
  position: number;
  approved: boolean;
  created_at: string;
}

const toPhoto = (r: Row): AreaPhoto => ({
  id: r.id,
  path: r.path,
  url: sb.storage.from(BUCKET).getPublicUrl(r.path).data.publicUrl,
  author: r.author,
  dev: r.dev,
  width: r.width,
  height: r.height,
  approved: r.approved,
  date: Date.parse(r.created_at),
});

// Visitors receive approved photos; the admin also receives the ones waiting
export async function fetchPhotos() {
  const { data, error } = await sb
    .from("area_photos")
    .select(COLUMNS)
    .order("position")
    .order("created_at")
    .limit(5000);
  if (error) throw error;
  const byArea = new Map<string, AreaPhoto[]>();
  for (const row of (data ?? []) as Row[]) {
    byArea.set(row.area_id, [...(byArea.get(row.area_id) ?? []), toPhoto(row)]);
  }
  return byArea;
}

// A phone photo or 4K screenshot becomes a JPEG of a few hundred KB
async function shrink(file: File) {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("not_image");
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("not_image");
  return { blob, width, height };
}

// Upload the file, then add its row. Rows from visitors wait for approval and can't be read back.
export async function uploadPhoto(areaId: string, file: File, author: string) {
  const { blob, width, height } = await shrink(file);
  await ensureVisitor();
  const path = `${areaId}/${crypto.randomUUID()}.jpg`;
  const up = await sb.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (up.error) throw up.error;
  const { error } = await sb.from("area_photos").insert({ area_id: areaId, path, author, width, height });
  if (error) throw error;
}

export async function approvePhoto(id: string) {
  const { error } = await sb.from("area_photos").update({ approved: true }).eq("id", id);
  if (error) throw error;
}

export async function deletePhoto(photo: AreaPhoto) {
  const { error } = await sb.from("area_photos").delete().eq("id", photo.id);
  if (error) throw error;
  // The row is gone, so the photo no longer shows; a file left behind is only wasted space
  await sb.storage.from(BUCKET).remove([photo.path]).catch(() => undefined);
}

export async function reorderPhotos(areaId: string, ids: string[]) {
  const { error } = await sb.rpc("reorder_area_photos", { area: areaId, ids });
  if (error) throw error;
}

export const confirmDelete = () => window.confirm("Delete this photo? This can't be undone.");
