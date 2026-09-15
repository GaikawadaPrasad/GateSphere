import { describe, it, expect } from "vitest";
import { parseQrPayload, decodeQrFromImageData } from "@/lib/qr-decoder";
import QRCode from "qrcode";

describe("QR Code Decoder & Parser", () => {
  describe("parseQrPayload", () => {
    it("parses JSON QR payload correctly", () => {
      const payload = JSON.stringify({
        token: "tok-abc-123",
        pin: "482910",
        category: "guest",
        reason: "Family visit",
        visitor_name: "Rahul Sharma",
        unit_label: "A-402",
      });

      const parsed = parseQrPayload(payload);
      expect(parsed.token).toBe("tok-abc-123");
      expect(parsed.pin).toBe("482910");
      expect(parsed.category).toBe("guest");
      expect(parsed.reason).toBe("Family visit");
      expect(parsed.visitorName).toBe("Rahul Sharma");
      expect(parsed.unitLabel).toBe("A-402");
      expect(parsed.type).toBe("token");
    });

    it("parses pure 6-digit numeric PIN", () => {
      const parsed = parseQrPayload("987654");
      expect(parsed.pin).toBe("987654");
      expect(parsed.type).toBe("pin");
    });

    it("parses QR-prefixed tokens", () => {
      const parsed = parseQrPayload("QR-sec-pass-uuid-999");
      expect(parsed.token).toBe("sec-pass-uuid-999");
      expect(parsed.type).toBe("token");
    });

    it("parses staff badge QR strings and staff codes", () => {
      const parsed = parseQrPayload("GSE:STAFF:user-123:SEC-VERIFIED");
      expect(parsed.token).toBe("GSE:STAFF:user-123:SEC-VERIFIED");
      expect(parsed.type).toBe("staff");

      const staffCode = parseQrPayload("PASS-STAFF-9021");
      expect(staffCode.type).toBe("staff");
    });

    it("parses vendor and technician gate passes", () => {
      const parsed = parseQrPayload("GS-PASS-TKT-1024-ABC12345");
      expect(parsed.type).toBe("vendor");
      expect(parsed.category).toBe("Vendor / Service Technician");
      expect(parsed.reason).toContain("TKT-1024");

      const passVen = parseQrPayload("PASS-VEN-8812");
      expect(passVen.type).toBe("vendor");
    });

    it("parses delivery passes", () => {
      const parsed = parseQrPayload("DEL-AMZN-9988");
      expect(parsed.type).toBe("delivery");
      expect(parsed.category).toBe("Courier / Delivery");
    });

    it("strips OTP / PIN prefixes to extract pure numeric codes", () => {
      const otp = parseQrPayload("OTP-8819");
      expect(otp.pin).toBe("8819");
      expect(otp.type).toBe("pin");

      const pin = parseQrPayload("PIN-654321");
      expect(pin.pin).toBe("654321");
      expect(pin.type).toBe("pin");
    });

    it("parses URL containing token or pin query parameters", () => {
      const parsed = parseQrPayload("https://gate-sphere.vercel.app/verify?token=pass-token-555&pin=1234");
      expect(parsed.token).toBe("pass-token-555");
      expect(parsed.pin).toBe("1234");
      expect(parsed.type).toBe("token");
    });
  });

  describe("decodeQrFromImageData with real QR code", () => {
    it("encodes a message with QRCode and accurately decodes it with jsQR", async () => {
      const testSecret = "GSE-GATE-ENTRY-TOKEN-778899";

      // Generate raw RGBA data using qrcode package
      const qrData = await QRCode.create(testSecret, { errorCorrectionLevel: "M" });
      const size = qrData.modules.size;
      const scale = 4;
      const width = size * scale;
      const height = size * scale;

      // Create RGBA Uint8ClampedArray
      const rgba = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const modX = Math.floor(x / scale);
          const modY = Math.floor(y / scale);
          const isDark = qrData.modules.get(modX, modY);
          const idx = (y * width + x) * 4;
          const val = isDark ? 0 : 255;
          rgba[idx] = val;     // R
          rgba[idx + 1] = val; // G
          rgba[idx + 2] = val; // B
          rgba[idx + 3] = 255; // A
        }
      }

      const decoded = decodeQrFromImageData(rgba, width, height);
      expect(decoded).toBe(testSecret);
    });
  });
});
