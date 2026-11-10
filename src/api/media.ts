import { apiFetch } from "./client";
import { getAccessToken } from "@/session/tokenStore";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

interface UploadUrlResponse {
  uploadUrl: string;
  method: string;
  objectKey: string;
}

/** Picks a local asset URI through the media upload flow and returns its absolute, servable URL. */
export async function uploadLocalAsset(localUri: string, contentType: string): Promise<string> {
  const { uploadUrl, objectKey } = await apiFetch<UploadUrlResponse>("/api/media/upload-url", {
    method: "POST",
    body: JSON.stringify({ kind: contentType.startsWith("video") ? "video" : "image", contentType }),
  });

  const bytes = await (await fetch(localUri)).blob();
  const accessToken = await getAccessToken();
  const putRes = await fetch(`${BASE_URL}${uploadUrl}`, {
    method: "PUT",
    headers: { "Content-Type": contentType, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: bytes,
  });
  if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

  const { url } = await apiFetch<{ url: string }>("/api/media/confirm", {
    method: "POST",
    body: JSON.stringify({ objectKey }),
  });
  // The backend now returns an absolute URL (Supabase Storage's public
  // object URL) rather than a same-origin path — only prefix BASE_URL if
  // it's still relative, so this keeps working either way.
  return url.startsWith("http") ? url : `${BASE_URL}${url}`;
}
