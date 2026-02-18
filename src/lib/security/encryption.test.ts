import { describe, it, expect, beforeAll } from "vitest"
import { encrypt, decrypt, isEncrypted, encryptFields, decryptFields, generateEncryptionKey } from "./encryption"

// Set test encryption key
beforeAll(() => {
  process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
})

describe("encrypt/decrypt", () => {
  it("should encrypt and decrypt a string correctly", async () => {
    const plaintext = "SK3112000000198742637541"
    const encrypted = await encrypt(plaintext)

    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toContain(":")

    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it("should produce different ciphertext for same plaintext (random IV)", async () => {
    const plaintext = "Rodné číslo: 850101/1234"
    const encrypted1 = await encrypt(plaintext)
    const encrypted2 = await encrypt(plaintext)

    expect(encrypted1).not.toBe(encrypted2) // Different IVs
    expect(await decrypt(encrypted1)).toBe(plaintext)
    expect(await decrypt(encrypted2)).toBe(plaintext)
  })

  it("should handle empty string", async () => {
    const encrypted = await encrypt("")
    expect(encrypted).toBe("")
  })

  it("should handle special characters", async () => {
    const plaintext = "IBAN: SK31 1200 0000 1987 4263 7541 / BIC: TATRSKBX"
    const encrypted = await encrypt(plaintext)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it("should handle Slovak diacritics", async () => {
    const plaintext = "Ján Ťuknutý, Žilina, ľščťžýáíé"
    const encrypted = await encrypt(plaintext)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it("should return original value for non-encrypted input in decrypt", async () => {
    const plain = "not-encrypted"
    const result = await decrypt(plain)
    expect(result).toBe(plain)
  })
})

describe("isEncrypted", () => {
  it("should detect encrypted values", async () => {
    const encrypted = await encrypt("test")
    expect(isEncrypted(encrypted)).toBe(true)
  })

  it("should return false for plain text", () => {
    expect(isEncrypted("SK3112000000198742637541")).toBe(false)
    expect(isEncrypted("")).toBe(false)
    expect(isEncrypted("hello world")).toBe(false)
  })
})

describe("encryptFields / decryptFields", () => {
  it("should encrypt and decrypt specific fields of an object", async () => {
    const employee = {
      name: "Ján Novák",
      birth_number: "850101/1234",
      bank_account_iban: "SK3112000000198742637541",
      email: "jan@example.com",
    }

    const encrypted = await encryptFields(employee, ["birth_number", "bank_account_iban"])

    // Name and email should be unchanged
    expect(encrypted.name).toBe("Ján Novák")
    expect(encrypted.email).toBe("jan@example.com")

    // Sensitive fields should be encrypted
    expect(encrypted.birth_number).not.toBe("850101/1234")
    expect(encrypted.bank_account_iban).not.toBe("SK3112000000198742637541")
    expect(isEncrypted(encrypted.birth_number)).toBe(true)
    expect(isEncrypted(encrypted.bank_account_iban)).toBe(true)

    // Decrypt back
    const decrypted = await decryptFields(encrypted, ["birth_number", "bank_account_iban"])
    expect(decrypted.birth_number).toBe("850101/1234")
    expect(decrypted.bank_account_iban).toBe("SK3112000000198742637541")
  })

  it("should not double-encrypt already encrypted fields", async () => {
    const data = { secret: "test-value" }
    const encrypted1 = await encryptFields(data, ["secret"])
    const encrypted2 = await encryptFields(encrypted1, ["secret"])

    // Should not encrypt an already encrypted value
    expect(encrypted2.secret).toBe(encrypted1.secret)

    const decrypted = await decryptFields(encrypted2, ["secret"])
    expect(decrypted.secret).toBe("test-value")
  })
})

describe("generateEncryptionKey", () => {
  it("should generate a 64-character hex string", () => {
    const key = generateEncryptionKey()
    expect(key).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(key)).toBe(true)
  })

  it("should generate unique keys", () => {
    const key1 = generateEncryptionKey()
    const key2 = generateEncryptionKey()
    expect(key1).not.toBe(key2)
  })
})
