/**
 * Utility helper for managing device fingerprints and device naming
 */

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'MOBILE' | 'TABLET' | 'DESKTOP' | 'OTHER';
  browser: string;
  os: string;
  hardwareFingerprint: string;
}

/**
 * Fast 32-bit FNV-1a hash algorithm converting string to hex
 */
function hashString(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Offscreen Canvas Fingerprinting
 */
function getCanvasFingerprint(): string {
  if (typeof window === 'undefined') return 'no_canvas';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no_ctx';

    // Draw background gradient
    const grad = ctx.createLinearGradient(0, 0, 200, 0);
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(1, '#10b981');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 200, 50);

    // Draw stylized text with shadows
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText('StudentCheckin,123!#$', 10, 30);

    return hashString(canvas.toDataURL());
  } catch (e) {
    return 'canvas_err';
  }
}

/**
 * WebGL GPU Vendor & Renderer Fingerprinting
 */
function getWebGLFingerprint(): string {
  if (typeof window === 'undefined') return 'no_webgl';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no_webgl';
    const webglGl = gl as WebGLRenderingContext;
    const debugInfo = webglGl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no_debug';

    const vendor = webglGl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
    const renderer = webglGl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    return hashString(`${vendor}~${renderer}`);
  } catch (e) {
    return 'webgl_err';
  }
}

/**
 * Generates a stable hardware + environment signature.
 * This remains consistent across Normal and Private/Incognito browsing on the same device.
 */
export function generateHardwareFingerprint(): string {
  if (typeof window === 'undefined') return 'fp_server';

  const ua = navigator.userAgent || '';
  const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}_${window.devicePixelRatio || 1}`;
  const language = navigator.language || (navigator.languages && navigator.languages[0]) || '';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const cores = navigator.hardwareConcurrency || 'unk_cores';
  const memory = (navigator as any).deviceMemory || 'unk_mem';

  const canvasFp = getCanvasFingerprint();
  const webglFp = getWebGLFingerprint();

  const rawFingerprintString = [
    ua,
    screenInfo,
    language,
    tz,
    cores,
    memory,
    canvasFp,
    webglFp,
  ].join('||');

  return `fp_${hashString(rawFingerprintString)}`;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'dev_server';

  const hardwareFp = generateHardwareFingerprint();

  let storedId = '';
  try {
    storedId = localStorage.getItem('app_device_uuid') || '';
  } catch (e) {
    // LocalStorage error or restricted in private mode
  }

  if (storedId) {
    if (storedId.includes(hardwareFp)) {
      return storedId;
    }
    return `${storedId}_${hardwareFp}`;
  }

  // In Incognito/Private mode or when localStorage is blank:
  // Return deterministic deviceId using hardware fingerprint
  const incognitoDeviceId = `dev_${hardwareFp}`;
  try {
    localStorage.setItem('app_device_uuid', incognitoDeviceId);
  } catch (e) {
    // Ignore error
  }

  return incognitoDeviceId;
}

export function getDeviceInfo(): DeviceInfo {
  const deviceId = getOrCreateDeviceId();
  const hardwareFingerprint = generateHardwareFingerprint();

  if (typeof window === 'undefined') {
    return {
      deviceId,
      deviceName: 'Server Environment',
      deviceType: 'DESKTOP',
      browser: 'Unknown',
      os: 'Unknown',
      hardwareFingerprint,
    };
  }

  const ua = navigator.userAgent || '';

  // Detect OS
  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  // Detect Browser
  let browser = 'Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';

  // Detect Device Type
  let deviceType: 'MOBILE' | 'TABLET' | 'DESKTOP' | 'OTHER' = 'DESKTOP';
  const isMobile = /mobile/i.test(ua) || /iphone|ipod/i.test(ua) || (/android/i.test(ua) && !/tablet/i.test(ua));
  const isTablet = /ipad/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua));

  if (isTablet) {
    deviceType = 'TABLET';
  } else if (isMobile) {
    deviceType = 'MOBILE';
  } else {
    deviceType = 'DESKTOP';
  }

  // Generate Human Friendly Device Name
  let deviceName = `${browser} (${os})`;
  if (os === 'iOS') {
    deviceName = isTablet ? `iPad (${browser})` : `iPhone (${browser})`;
  } else if (os === 'Android') {
    deviceName = isTablet ? `Android Tablet (${browser})` : `Android Phone (${browser})`;
  } else if (os === 'macOS') {
    deviceName = `Mac (${browser})`;
  } else if (os === 'Windows') {
    deviceName = `Windows PC (${browser})`;
  }

  return {
    deviceId,
    deviceName,
    deviceType,
    browser,
    os,
    hardwareFingerprint,
  };
}
