/**
 * Digital Signature Service for Slovak eGovernment (KEP/eIDAS)
 *
 * Provides XAdES-based XML digital signatures for eDane submissions.
 * In production, integrates with:
 * - D.Signer/XAdES (DITEC) for qualified electronic signatures
 * - eID klient (slovensko.sk) for citizen eID card signing
 * - Cloud-based KEP providers (Disig, CA Certika)
 *
 * Currently provides preparation and envelope generation;
 * actual signing requires a browser-side component or external service.
 */

export type SignatureMethod = "xades_bes" | "xades_t" | "xades_epes"
export type SignatureLevel = "basic" | "qualified" // basic = AES, qualified = KEP

export interface SignatureConfig {
  method: SignatureMethod
  level: SignatureLevel
  /** Certificate in PEM or Base64-DER format */
  certificate?: string
  /** Timestamp authority URL for XAdES-T */
  tsaUrl?: string
  /** Signing policy URI for XAdES-EPES */
  policyUri?: string
}

export interface SignatureResult {
  success: boolean
  signedXml?: string
  signatureId?: string
  signingTime?: string
  certificateSubject?: string
  error?: string
}

export interface SigningRequest {
  /** Original XML content to sign */
  xmlContent: string
  /** Type of document (for FS SR envelope) */
  documentType: string
  /** Signature configuration */
  config: SignatureConfig
}

// Default FS SR XAdES configuration
const DEFAULT_CONFIG: SignatureConfig = {
  method: "xades_bes",
  level: "qualified",
  tsaUrl: "http://tsa.disig.sk/tsa/tsa.aspx",
}

// XSD namespace constants for Slovak eDane XAdES
const XMLDSIG_NS = "http://www.w3.org/2000/09/xmldsig#"
const XADES_NS = "http://uri.etsi.org/01903/v1.3.2#"

/**
 * Prepare an XML document for signing.
 * Wraps the XML in a standard FS SR envelope with signature placeholder.
 */
export function prepareForSigning(
  xmlContent: string,
  documentType: string
): string {
  const envelopeId = `env_${Date.now()}`

  return `<?xml version="1.0" encoding="UTF-8"?>
<GeneralAgenda xmlns="http://schemas.gov.sk/form/App.GeneralAgenda/1.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <subject>${escapeXml(getSubjectForType(documentType))}</subject>
  <text>${escapeXml(documentType)}</text>
</GeneralAgenda>`
}

/**
 * Create a XAdES-BES signature envelope around an XML document.
 * This generates the signature structure; the actual cryptographic
 * signing must be performed by a KEP client.
 */
export function createSignatureEnvelope(
  xmlContent: string,
  config: SignatureConfig = DEFAULT_CONFIG
): string {
  const signatureId = `sig_${Date.now()}`
  const signingTime = new Date().toISOString()

  // Reference to the signed data
  const signedInfoXml = `
    <ds:SignedInfo xmlns:ds="${XMLDSIG_NS}">
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <ds:Reference URI="">
        <ds:Transforms>
          <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
          <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        </ds:Transforms>
        <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <ds:DigestValue></ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>`

  // XAdES signed properties
  const xadesProperties = `
    <xades:QualifyingProperties xmlns:xades="${XADES_NS}" Target="#${signatureId}">
      <xades:SignedProperties>
        <xades:SignedSignatureProperties>
          <xades:SigningTime>${signingTime}</xades:SigningTime>
          <xades:SigningCertificate>
            <xades:Cert>
              <xades:CertDigest>
                <ds:DigestMethod xmlns:ds="${XMLDSIG_NS}" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                <ds:DigestValue xmlns:ds="${XMLDSIG_NS}"></ds:DigestValue>
              </xades:CertDigest>
            </xades:Cert>
          </xades:SigningCertificate>
        </xades:SignedSignatureProperties>
      </xades:SignedProperties>
    </xades:QualifyingProperties>`

  // Assemble the full signature block
  const signatureBlock = `
  <ds:Signature xmlns:ds="${XMLDSIG_NS}" Id="${signatureId}">
    ${signedInfoXml}
    <ds:SignatureValue></ds:SignatureValue>
    <ds:KeyInfo>
      <ds:X509Data>
        <ds:X509Certificate>${config.certificate || ""}</ds:X509Certificate>
      </ds:X509Data>
    </ds:KeyInfo>
    <ds:Object>
      ${xadesProperties}
    </ds:Object>
  </ds:Signature>`

  // Insert before closing root tag
  const closingTagMatch = xmlContent.match(/<\/([^>]+)>\s*$/)
  if (closingTagMatch) {
    const insertPos = xmlContent.lastIndexOf(closingTagMatch[0])
    return (
      xmlContent.substring(0, insertPos) +
      signatureBlock +
      "\n" +
      closingTagMatch[0]
    )
  }

  // Fallback: append
  return xmlContent + signatureBlock
}

/**
 * Generate a signing request for a browser-based or external signing service.
 * Returns the data needed by D.Signer or eID klient.
 */
export function createSigningRequest(
  xmlContent: string,
  documentType: string,
  config: SignatureConfig = DEFAULT_CONFIG
): {
  dataToSign: string
  signatureId: string
  algorithm: string
  digestAlgorithm: string
  signingTime: string
} {
  const signatureId = `sig_${Date.now()}`

  return {
    dataToSign: Buffer.from(xmlContent, "utf-8").toString("base64"),
    signatureId,
    algorithm: "RSA-SHA256",
    digestAlgorithm: "SHA-256",
    signingTime: new Date().toISOString(),
  }
}

/**
 * Verify basic structure of a signed XML document.
 * Full cryptographic verification requires certificate chain validation.
 */
export function verifySignatureStructure(signedXml: string): {
  hasSig: boolean
  signatureId: string | null
  signingTime: string | null
  certificatePresent: boolean
  issues: string[]
} {
  const issues: string[] = []

  const hasSig = signedXml.includes("<ds:Signature") || signedXml.includes("<Signature")

  if (!hasSig) {
    issues.push("Dokument neobsahuje digitálny podpis")
    return { hasSig: false, signatureId: null, signingTime: null, certificatePresent: false, issues }
  }

  // Extract signature ID
  const sigIdMatch = signedXml.match(/Signature[^>]*Id="([^"]*)"/)
  const signatureId = sigIdMatch ? sigIdMatch[1] : null

  // Extract signing time
  const timeMatch = signedXml.match(/<(?:xades:)?SigningTime>([^<]*)</)
  const signingTime = timeMatch ? timeMatch[1] : null

  if (!signingTime) {
    issues.push("Chýba čas podpisu (SigningTime)")
  }

  // Check certificate
  const certPresent = signedXml.includes("<ds:X509Certificate>") || signedXml.includes("<X509Certificate>")
  if (!certPresent) {
    issues.push("Chýba certifikát podpisovateľa")
  }

  // Check digest values are filled
  if (signedXml.includes("<ds:DigestValue></ds:DigestValue>") ||
      signedXml.includes("<DigestValue></DigestValue>")) {
    issues.push("DigestValue nie je vyplnený — podpis nebol dokončený")
  }

  // Check signature value
  if (signedXml.includes("<ds:SignatureValue></ds:SignatureValue>") ||
      signedXml.includes("<SignatureValue></SignatureValue>")) {
    issues.push("SignatureValue nie je vyplnený — podpis nebol dokončený")
  }

  return {
    hasSig,
    signatureId,
    signingTime,
    certificatePresent: certPresent,
    issues,
  }
}

/** Map document type to Slovak subject line for FS SR submission */
function getSubjectForType(documentType: string): string {
  const subjects: Record<string, string> = {
    dph_priznanie: "Daňové priznanie k DPH",
    kontrolny_vykaz: "Kontrolný výkaz DPH",
    suhrnny_vykaz: "Súhrnný výkaz",
    dppo: "Daňové priznanie k dani z príjmov právnických osôb",
    dpfo: "Daňové priznanie k dani z príjmov fyzických osôb",
    mesacny_prehlad: "Mesačný prehľad o zrazených preddavkoch na daň",
    rocne_hlasenie: "Ročné hlásenie o vyúčtovaní dane",
  }
  return subjects[documentType] || "Elektronické podanie"
}

/** Escape special XML characters */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
