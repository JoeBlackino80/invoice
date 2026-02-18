/**
 * AES-256-GCM encryption for sensitive PII data.
 * Used for encrypting personal data at rest (SSN, IBAN, personal IDs).
 *
 * Key management: encryption key is stored in ENCRYPTION_KEY env variable.
 * In production, use a KMS (AWS KMS, Google Cloud KMS, or Vault).
 */

const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12  // 96 bits for GCM
const TAG_LENGTH = 128

/**
 * Get or derive encryption key from environment.
 * Key must be 32 bytes (256 bits) hex-encoded.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error(
      "ENCRYPTION_KEY nie je nastavený. Vygenerujte 32-bajtový hex kľúč: openssl rand -hex 32"
    )
  }

  const keyBuffer = hexToBuffer(keyHex)
  if (keyBuffer.byteLength !== 32) {
    throw new Error("ENCRYPTION_KEY musí mať 32 bajtov (64 hex znakov)")
  }

  return crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  )
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes.buffer
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns format: iv_hex:ciphertext_hex
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return ""

  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    data
  )

  const ivHex = bufferToHex(iv.buffer)
  const ctHex = bufferToHex(ciphertext)

  return `${ivHex}:${ctHex}`
}

/**
 * Decrypt a ciphertext string encrypted with encrypt().
 * Input format: iv_hex:ciphertext_hex
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext || !ciphertext.includes(":")) return ciphertext

  const [ivHex, ctHex] = ciphertext.split(":")
  if (!ivHex || !ctHex) return ciphertext

  const key = await getEncryptionKey()
  const iv = new Uint8Array(hexToBuffer(ivHex))
  const ct = hexToBuffer(ctHex)

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    ct
  )

  return new TextDecoder().decode(decrypted)
}

/**
 * Check if a value appears to be encrypted (matches iv:ciphertext format)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false
  const parts = value.split(":")
  return parts.length === 2 && /^[0-9a-f]{24}$/.test(parts[0]) && /^[0-9a-f]+$/.test(parts[1])
}

/**
 * Encrypt specific fields of an object.
 * Returns a new object with specified fields encrypted.
 */
export async function encryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...obj }

  for (const field of fields) {
    const value = result[field]
    if (typeof value === "string" && value && !isEncrypted(value)) {
      (result as any)[field] = await encrypt(value)
    }
  }

  return result
}

/**
 * Decrypt specific fields of an object.
 * Returns a new object with specified fields decrypted.
 */
export async function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...obj }

  for (const field of fields) {
    const value = result[field]
    if (typeof value === "string" && isEncrypted(value)) {
      (result as any)[field] = await decrypt(value)
    }
  }

  return result
}

/**
 * Fields that should be encrypted per entity type.
 * This is the central configuration for PII encryption.
 */
export const ENCRYPTED_FIELDS = {
  /** Employee sensitive fields */
  employee: ["birth_number", "id_card_number", "bank_account_iban", "bank_account_bic"] as const,
  /** Contact sensitive fields */
  contact: ["bank_account_iban", "bank_account_bic"] as const,
  /** Company sensitive fields */
  company: ["bank_account_iban", "bank_account_bic"] as const,
} as const

/**
 * Generate a new encryption key (for setup)
 */
export function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32))
  return bufferToHex(key.buffer)
}
