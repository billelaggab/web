/** بناء روابط وصول مؤقتة للوسائط — يُستدعى من مكوّنات الخادم فقط (توقيع HMAC). */
import { signFileToken } from "@/lib/security";

export function documentPreviewUrl(documentId: string, download = false): string {
  const token = encodeURIComponent(signFileToken(documentId));
  return `/api/documents/${documentId}/file?token=${token}${download ? "&download=1" : ""}`;
}

export function documentDownloadUrl(documentId: string): string {
  return documentPreviewUrl(documentId, true);
}
