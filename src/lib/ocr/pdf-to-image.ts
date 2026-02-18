// For PDF files, we'll send them to Claude as document type
// Claude can process PDF files directly
export async function extractPDFBase64(buffer: Buffer): Promise<{ base64: string; mimeType: string }> {
  // Claude Vision API accepts PDFs directly as document type
  const base64 = buffer.toString("base64")
  return { base64, mimeType: "application/pdf" }
}

export function isImageFile(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)
}

export function isPDFFile(mimeType: string): boolean {
  return mimeType === "application/pdf"
}

export function isSupportedFile(mimeType: string): boolean {
  return isImageFile(mimeType) || isPDFFile(mimeType)
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]
