/**
 * Utility helper for managing device fingerprints and device naming
 */

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'MOBILE' | 'TABLET' | 'DESKTOP' | 'OTHER';
  browser: string;
  os: string;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'dev_server';
  
  let id = localStorage.getItem('app_device_uuid');
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('app_device_uuid', id);
  }
  return id;
}

export function getDeviceInfo(): DeviceInfo {
  const deviceId = getOrCreateDeviceId();
  
  if (typeof window === 'undefined') {
    return {
      deviceId,
      deviceName: 'Server Environment',
      deviceType: 'DESKTOP',
      browser: 'Unknown',
      os: 'Unknown',
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
  };
}
