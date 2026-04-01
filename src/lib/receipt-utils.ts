export function getReceiptDownloadUrl(path: string | null | undefined) {
  if (!path) return null;
  return `/api/receipts?path=${encodeURIComponent(path)}`;
}
