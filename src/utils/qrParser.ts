export interface ParsedQRCheckin {
  rawToken: string;
  type: 'SES' | 'EVT' | 'TOKEN';
  targetId?: string;
  qrToken?: string;
  isFromCameraLink?: boolean;
}

/**
 * Parses raw text or URL scanned from native camera or QR scanner.
 * Supports:
 * - Direct camera link: https://domain.com/?checkin=SES:sessionId:ABC123
 * - Prefix string: SES:sessionId:ABC123 or EVT:eventId:ABC123
 * - Plain 6-character token: ABC123
 */
export function parseCheckinToken(input: string): ParsedQRCheckin {
  if (!input) return { rawToken: '', type: 'TOKEN' };
  let str = input.trim();
  let isFromCameraLink = false;

  if (str.includes('checkin=') || str.includes('http://') || str.includes('https://')) {
    isFromCameraLink = true;
    try {
      if (str.includes('?checkin=')) {
        const urlObj = new URL(str, window.location.origin);
        const param = urlObj.searchParams.get('checkin');
        if (param) {
          str = decodeURIComponent(param).trim();
        }
      } else {
        const match = str.match(/checkin=([^&]+)/);
        if (match && match[1]) {
          str = decodeURIComponent(match[1]).trim();
        }
      }
    } catch {
      const match = str.match(/checkin=([^&]+)/);
      if (match && match[1]) {
        str = decodeURIComponent(match[1]).trim();
      }
    }
  }

  if (str.startsWith('SES:') || str.startsWith('EVT:')) {
    const parts = str.split(':');
    if (parts.length >= 3) {
      return {
        rawToken: str,
        type: parts[0] as 'SES' | 'EVT',
        targetId: parts[1],
        qrToken: parts[2],
        isFromCameraLink,
      };
    } else if (parts.length === 2) {
      return {
        rawToken: str,
        type: parts[0] as 'SES' | 'EVT',
        targetId: parts[1],
        isFromCameraLink,
      };
    }
  }

  return {
    rawToken: str,
    type: 'TOKEN',
    qrToken: str,
    isFromCameraLink,
  };
}
