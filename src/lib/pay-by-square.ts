import QRCode from "qrcode";

export interface PayBySquareData {
  amount: number;
  currency: string;
  iban: string;
  bic?: string;
  variableSymbol?: string;
  constantSymbol?: string;
  specificSymbol?: string;
  recipientName: string;
  dueDate?: string; // YYYY-MM-DD format
  note?: string;
}

/**
 * Generates a PAY by square QR code for Slovak bank payments using SPD (Short Payment Descriptor) format.
 * The QR code can be scanned by Slovak banking applications to prefill payment information.
 *
 * @param data - Payment data containing amount, IBAN, recipient name, and optional fields
 * @returns A promise that resolves to a data URL (base64 PNG) of the generated QR code
 *
 * @example
 * const qrDataUrl = await generatePayBySquareQR({
 *   amount: 100.50,
 *   currency: 'EUR',
 *   iban: 'SK3611000000002647512001',
 *   bic: 'TATRSKBX',
 *   recipientName: 'Company Name',
 *   variableSymbol: '123456',
 *   dueDate: '2024-12-31',
 *   note: 'Invoice #INV-001'
 * });
 */
export async function generatePayBySquareQR(
  data: PayBySquareData
): Promise<string> {
  // Validate required fields
  if (!data.amount || !data.currency || !data.iban || !data.recipientName) {
    throw new Error(
      "Missing required fields: amount, currency, iban, and recipientName are mandatory"
    );
  }

  // Format amount with 2 decimal places
  const formattedAmount = data.amount.toFixed(2);

  // Format due date to YYYYMMDD if provided, otherwise use empty string
  let dueDateFormatted = "";
  if (data.dueDate) {
    const date = new Date(data.dueDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    dueDateFormatted = `${year}${month}${day}`;
  }

  // Build the SPD (Short Payment Descriptor) format string
  // Format: SPD*1.0*ACC:{IBAN}+{BIC}*AM:{amount}*CC:{currency}*X-VS:{VS}*X-KS:{KS}*X-SS:{SS}*DT:{YYYYMMDD}*MSG:{note}*
  let spdString = `SPD*1.0*ACC:${data.iban}`;

  // Add BIC if provided
  if (data.bic) {
    spdString += `+${data.bic}`;
  }

  // Add amount and currency
  spdString += `*AM:${formattedAmount}*CC:${data.currency}`;

  // Add variable symbol if provided
  if (data.variableSymbol) {
    spdString += `*X-VS:${data.variableSymbol}`;
  }

  // Add constant symbol if provided
  if (data.constantSymbol) {
    spdString += `*X-KS:${data.constantSymbol}`;
  }

  // Add specific symbol if provided
  if (data.specificSymbol) {
    spdString += `*X-SS:${data.specificSymbol}`;
  }

  // Add due date if provided
  if (dueDateFormatted) {
    spdString += `*DT:${dueDateFormatted}`;
  }

  // Add message/note if provided
  if (data.note) {
    spdString += `*MSG:${data.note}`;
  }

  // End with asterisk
  spdString += "*";

  try {
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(spdString, {
      errorCorrectionLevel: "M",
      type: "image/png",
      margin: 1,
      width: 300,
    } as QRCode.QRCodeToDataURLOptions);

    return qrDataUrl as string;
  } catch (error) {
    throw new Error(
      `Failed to generate QR code: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generates a simplified PAY by square payment string for debugging or testing.
 * Returns the SPD string that would be encoded in the QR code.
 *
 * @param data - Payment data
 * @returns The SPD format payment string
 */
export function generatePayBySquareString(data: PayBySquareData): string {
  if (!data.amount || !data.currency || !data.iban || !data.recipientName) {
    throw new Error(
      "Missing required fields: amount, currency, iban, and recipientName are mandatory"
    );
  }

  const formattedAmount = data.amount.toFixed(2);

  let dueDateFormatted = "";
  if (data.dueDate) {
    const date = new Date(data.dueDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    dueDateFormatted = `${year}${month}${day}`;
  }

  let spdString = `SPD*1.0*ACC:${data.iban}`;

  if (data.bic) {
    spdString += `+${data.bic}`;
  }

  spdString += `*AM:${formattedAmount}*CC:${data.currency}`;

  if (data.variableSymbol) {
    spdString += `*X-VS:${data.variableSymbol}`;
  }

  if (data.constantSymbol) {
    spdString += `*X-KS:${data.constantSymbol}`;
  }

  if (data.specificSymbol) {
    spdString += `*X-SS:${data.specificSymbol}`;
  }

  if (dueDateFormatted) {
    spdString += `*DT:${dueDateFormatted}`;
  }

  if (data.note) {
    spdString += `*MSG:${data.note}`;
  }

  spdString += "*";

  return spdString;
}
