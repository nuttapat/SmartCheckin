import jsQR from 'jsqr';
import { Html5Qrcode } from 'html5-qrcode';

export const decodeQRCodeFromImage = async (file: File): Promise<string> => {
  // Method 1: Try Html5Qrcode.scanFile
  try {
    const tempDivId = 'qr-file-reader-temp';
    let tempDiv = document.getElementById(tempDivId);
    if (!tempDiv) {
      tempDiv = document.createElement('div');
      tempDiv.id = tempDivId;
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);
    }
    const html5QrCode = new Html5Qrcode(tempDivId);
    const result = await html5QrCode.scanFile(file, false);
    if (result && result.trim()) {
      return result.trim();
    }
  } catch (e) {
    // Fallback to Canvas + jsQR multi-scale
  }

  // Method 2: Multi-scale Canvas rendering + jsQR decoding for smartphone photos
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        reject(new Error('ไม่สามารถสร้างระบบอ่านรูปภาพได้'));
        return;
      }

      // Smartphone camera photos are high res (e.g. 4000x3000). Try downscaling to 1200, 800, 500, and native
      const targetScales = [1200, 800, 500, Math.max(img.width, img.height)];

      for (const maxDim of targetScales) {
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);

        // Standard jsQR pass
        let code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
        if (!code || !code.data) {
          code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
        }

        if (code && code.data && code.data.trim()) {
          resolve(code.data.trim());
          return;
        }

        // Contrast boost pass
        ctx.filter = 'contrast(160%) brightness(105%)';
        ctx.drawImage(img, 0, 0, w, h);
        const filteredData = ctx.getImageData(0, 0, w, h);
        const codeFiltered = jsQR(filteredData.data, w, h, { inversionAttempts: 'attemptBoth' });

        if (codeFiltered && codeFiltered.data && codeFiltered.data.trim()) {
          resolve(codeFiltered.data.trim());
          return;
        }
      }

      reject(new Error('ไม่พบ QR Code ในรูปภาพ กรุณาเลือกหรือถ่ายรูปใหม่ให้เห็น QR Code ชัดเจน'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    };

    img.src = objectUrl;
  });
};
