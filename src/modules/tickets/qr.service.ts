import crypto from 'crypto';
import QRCode from 'qrcode';

export interface QrTicketData {
  ticketCode: string;
  cityName: string;
  sessionTitle: string;
  attendeeName: string;
}

export interface QrVerificationResult {
  valid: boolean;
  ticketCode?: string;
  cityName?: string;
  sessionTitle?: string;
  attendeeName?: string;
  error?: string;
}

const HMAC_SECRET = process.env.SCANNER_HMAC_SECRET || 'whiskytix_super_secret_hmac_key_2026';

/**
 * Generates an unforgeable cryptographic HMAC-SHA256 signature for a ticket
 */
export function generateTicketSignature(ticketCode: string, cityName: string, sessionTitle: string, attendeeName: string): string {
  const raw = `${ticketCode.trim().toUpperCase()}|${cityName.trim().toLowerCase()}|${sessionTitle.trim().toUpperCase()}|${attendeeName.trim()}`;
  return crypto.createHmac('sha256', HMAC_SECRET).update(raw).digest('hex').substring(0, 10);
}

/**
 * Builds the compact, high-density payload encoded inside the QR-code
 * Format: WT1:<ticketCode>:<city>:<session>:<attendeeName>:<10-char-hmac>
 */
export function buildQrPayload(data: QrTicketData): string {
  const sig = generateTicketSignature(data.ticketCode, data.cityName, data.sessionTitle, data.attendeeName);
  const cleanCode = data.ticketCode.replace(/^#/, '');
  const cleanName = data.attendeeName.replace(/[:|]/g, ' ');
  const cleanSession = data.sessionTitle.replace(/[:|]/g, ' ');
  return `WT1:${cleanCode}:${data.cityName}:${cleanSession}:${cleanName}:${sig}`;
}

/**
 * Validates a scanned QR payload against the HMAC secret
 */
export function verifyQrPayload(rawPayload: string): QrVerificationResult {
  try {
    if (!rawPayload.startsWith('WT1:')) {
      return { valid: false, error: 'Ongeldig QR-formaat (geen Whiskytix payload).' };
    }

    const parts = rawPayload.split(':');
    if (parts.length < 6) {
      return { valid: false, error: 'Onvolledige QR payload.' };
    }

    const [, ticketCode, cityName, sessionTitle, attendeeName, providedSig] = parts;
    const fullCode = `#${ticketCode}`;
    const expectedSig = generateTicketSignature(fullCode, cityName, sessionTitle, attendeeName);

    if (providedSig.toLowerCase() !== expectedSig.toLowerCase()) {
      return { valid: false, error: 'Digitale handtekening ongeldig! Mogelijk vervalst ticket.' };
    }

    return {
      valid: true,
      ticketCode: fullCode,
      cityName,
      sessionTitle,
      attendeeName,
    };
  } catch (err: any) {
    return { valid: false, error: 'Fout bij verifiëren van payload: ' + err.message };
  }
}

/**
 * Generates a crisp vector SVG string for web display
 */
export async function generateQrSvg(data: QrTicketData): Promise<string> {
  const payload = buildQrPayload(data);
  return await QRCode.toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: {
      dark: '#1D1C1AFF',
      light: '#FFFFFFFF',
    },
  });
}

/**
 * Generates a PNG DataURL for PDF embedding or <img> tags
 */
export async function generateQrPngDataUrl(data: QrTicketData, width = 300): Promise<string> {
  const payload = buildQrPayload(data);
  return await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width,
    color: {
      dark: '#1D1C1AFF',
      light: '#FFFFFFFF',
    },
  });
}
