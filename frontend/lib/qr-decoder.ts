import jsQR from "jsqr";

function getJsQR(): typeof jsQR {
  return typeof jsQR === "function" ? jsQR : (jsQR as any)?.default || jsQR;
}

export interface ParsedQrData {
  raw: string;
  token?: string;
  pin?: string;
  category?: string;
  reason?: string;
  visitorName?: string;
  unitLabel?: string;
  type?: "token" | "pin" | "staff" | "vendor" | "delivery" | "family" | "unknown";
}

/**
 * Parses decoded QR string into structured token / pin / metadata.
 * Handles:
 * 1. JSON payloads: {"token":"...", "pin":"...", "category":"...", ...}
 * 2. URL payloads: https://.../?token=... or ?pin=...
 * 3. Staff badges: GSE:STAFF:<id>:<code/verification> or STAFF-xxx
 * 4. Vendor passes: GS-PASS-TKT-xxx or PASS-VEN-xxx
 * 5. Numeric PINs / OTPs: "123456" or "OTP-123456"
 * 6. Raw tokens: "QR-xxx" or "VP-xxx"
 */
export function parseQrPayload(raw: string): ParsedQrData {
  const trimmed = raw.trim();
  if (!trimmed) return { raw: "", type: "unknown" };

  // 1. JSON String
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        const token = parsed.token || (parsed.pass_token ? String(parsed.pass_token) : undefined);
        const pin = parsed.pin ? String(parsed.pin) : undefined;
        return {
          raw: trimmed,
          token,
          pin,
          category: parsed.category || parsed.visitor_type,
          reason: parsed.reason || parsed.purpose,
          visitorName: parsed.visitor_name || parsed.name,
          unitLabel: parsed.unit_label || parsed.unit,
          type: pin && !token ? "pin" : "token",
        };
      }
    } catch {
      // Fall through to plain text parsing
    }
  }

  // 2. URL containing query params (?token=... or ?pin=...)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const token =
        url.searchParams.get("token") || url.searchParams.get("pass_token") || undefined;
      const pin = url.searchParams.get("pin") || undefined;
      if (token || pin) {
        return {
          raw: trimmed,
          token: token || undefined,
          pin: pin || undefined,
          type: pin && !token ? "pin" : "token",
        };
      }
    } catch {
      // Ignore URL parse error
    }
  }

  // 3. Staff Badge Format: GSE:STAFF:<id>:<code/verification> or STAFF-xxx
  if (
    trimmed.startsWith("GSE:STAFF:") ||
    trimmed.includes(":STAFF:") ||
    trimmed.startsWith("STAFF-") ||
    trimmed.startsWith("PASS-STAFF-")
  ) {
    return {
      raw: trimmed,
      token: trimmed,
      category: "Domestic Staff",
      reason: "Daily Household Service",
      visitorName: "Domestic Staff",
      unitLabel: "Assigned Community Units",
      type: "staff",
    };
  }

  // 4. Vendor / Technician Pass Format: GS-PASS-... or PASS-VEN-... or VEN-... or TKT-...
  if (
    trimmed.startsWith("GS-PASS-") ||
    trimmed.startsWith("PASS-VEN-") ||
    trimmed.startsWith("VEN-") ||
    trimmed.includes("TKT-")
  ) {
    const tktMatch = trimmed.match(/TKT-[\w\d]+/i);
    return {
      raw: trimmed,
      token: trimmed,
      category: "Vendor / Service Technician",
      reason: tktMatch
        ? `Maintenance Ticket Service (${tktMatch[0]})`
        : "Maintenance Ticket Service",
      visitorName: "Vendor Technician",
      unitLabel: "Community Facility / Unit",
      type: "vendor",
    };
  }

  // 5. Delivery Pass Format: DEL-... or COURIER-... or PASS-DEL-...
  if (
    trimmed.startsWith("DEL-") ||
    trimmed.startsWith("PASS-DEL-") ||
    trimmed.startsWith("COURIER-")
  ) {
    return {
      raw: trimmed,
      token: trimmed,
      category: "Courier / Delivery",
      reason: "Parcel Delivery",
      visitorName: "Delivery Agent",
      unitLabel: "Resident Unit",
      type: "delivery",
    };
  }

  // 5b. Family Member Permanent Pass: GSE:FAMILY:<id>:<pin> or GSE-FAM-... or PASS-FAM-...
  if (
    trimmed.startsWith("GSE:FAMILY:") ||
    trimmed.startsWith("GSE-FAM-") ||
    trimmed.startsWith("PASS-FAM-")
  ) {
    const parts = trimmed.split(":");
    const pinPart = parts.length >= 4 ? parts[3] : undefined;
    return {
      raw: trimmed,
      token: trimmed,
      pin: pinPart,
      category: "Pre-Approved Family Member",
      reason: "Permanent Resident Household Access",
      visitorName: "Family Member",
      unitLabel: "Resident Household Unit",
      type: "family",
    };
  }

  // 6. QR-prefixed Token (e.g. "QR-sec-pass-uuid-999")
  if (trimmed.startsWith("QR-")) {
    return {
      raw: trimmed,
      token: trimmed.slice(3),
      type: "token",
    };
  }

  // 7. Numeric PIN / OTP (e.g. "987654", "OTP-8819", "PIN-654321")
  if (trimmed.startsWith("OTP-") || trimmed.startsWith("PIN-") || /^\d{4,8}$/.test(trimmed)) {
    const numericOnly = trimmed.replace(/\D/g, "");
    if (numericOnly.length >= 4 && numericOnly.length <= 8) {
      return {
        raw: trimmed,
        pin: numericOnly,
        type: "pin",
      };
    }
  }

  // 8. Generic Token / String
  return {
    raw: trimmed,
    token: trimmed,
    type: "token",
  };
}

/**
 * Decodes QR code from raw ImageData using jsQR
 */
export function decodeQrFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  try {
    const jsQR = getJsQR();
    if (!jsQR) return null;
    const code = jsQR(data, width, height, {
      inversionAttempts: "attemptBoth",
    });
    return code ? code.data : null;
  } catch (err) {
    console.warn("[decodeQrFromImageData] Decode error:", err);
    return null;
  }
}

/**
 * Decodes QR code from an HTMLCanvasElement
 */
export function decodeQrFromCanvas(canvas: HTMLCanvasElement): string | null {
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return decodeQrFromImageData(imageData.data, canvas.width, canvas.height);
  } catch (err) {
    console.warn("[decodeQrFromCanvas] Canvas read error:", err);
    return null;
  }
}

/**
 * Decodes QR code from an HTMLVideoElement frame
 */
export function decodeQrFromVideo(
  video: HTMLVideoElement,
  offscreenCanvas?: HTMLCanvasElement,
): string | null {
  if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return null;

  const canvas = offscreenCanvas || document.createElement("canvas");
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (width === 0 || height === 0) return null;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, width, height);
  return decodeQrFromCanvas(canvas);
}

/**
 * Decodes QR code from an uploaded File / Blob (PNG, JPG, WEBP, etc.)
 */
export async function decodeQrFromFile(
  file: File | Blob,
): Promise<{ success: boolean; data?: string; parsed?: ParsedQrData; error?: string }> {
  try {
    // 1. Try Native BarcodeDetector if supported in browser
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        let imageSource: any;
        if (typeof createImageBitmap === "function") {
          imageSource = await createImageBitmap(file);
        }
        if (imageSource) {
          const barcodes = await detector.detect(imageSource);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            const raw = barcodes[0].rawValue;
            return {
              success: true,
              data: raw,
              parsed: parseQrPayload(raw),
            };
          }
        }
      } catch {
        // Fallback to canvas + jsQR
      }
    }

    // 2. Load file as Image and render to canvas
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load image file."));
      el.src = dataUrl;
    });

    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;

    if (!originalWidth || !originalHeight) {
      return { success: false, error: "Image dimensions could not be determined." };
    }

    // Prepare canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return { success: false, error: "Canvas 2D context is not available." };
    }

    // Pass 1: Scaled resolution (max 1024px) for fast, sharp scanning
    const maxDim = 1024;
    let targetWidth = originalWidth;
    let targetHeight = originalHeight;

    if (originalWidth > maxDim || originalHeight > maxDim) {
      if (originalWidth > originalHeight) {
        targetWidth = maxDim;
        targetHeight = Math.round((originalHeight * maxDim) / originalWidth);
      } else {
        targetHeight = maxDim;
        targetWidth = Math.round((originalWidth * maxDim) / originalHeight);
      }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    let decoded = decodeQrFromCanvas(canvas);

    // Pass 2: If not found and original was scaled, try native full resolution
    if (!decoded && (targetWidth !== originalWidth || targetHeight !== originalHeight)) {
      canvas.width = originalWidth;
      canvas.height = originalHeight;
      ctx.drawImage(img, 0, 0, originalWidth, originalHeight);
      decoded = decodeQrFromCanvas(canvas);
    }

    if (decoded) {
      return {
        success: true,
        data: decoded,
        parsed: parseQrPayload(decoded),
      };
    }

    return {
      success: false,
      error:
        "No QR code could be detected in this image. Please ensure the QR code is clearly visible and not blurry.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to process image file.",
    };
  }
}
