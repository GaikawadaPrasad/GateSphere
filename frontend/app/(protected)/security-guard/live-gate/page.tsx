"use client";

import { useState, useRef, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { QrScannerModal } from "@/components/common/QrScannerModal";
import {
  decodeQrFromFile,
  parseQrPayload,
  type ParsedQrData,
} from "@/lib/qr-decoder";
import { visitorsApi, domesticStaffApi, gateApi, residentsApi } from "@/lib/api";
import { WalkInVisitorModal } from "@/components/common/WalkInVisitorModal";
import { FileUpload } from "@/components/common/FileUpload";
import { toast } from "@/store/toast";

interface VerifiedEntry {
  entryId: string;
  visitorName: string;
  category?: string;
  reason?: string;
  unitLabel: string;
  vehicleNumber?: string | null;
  status: string;
  enteredAt?: string;
  isStaff?: boolean;
  isVendor?: boolean;
  isDelivery?: boolean;
  isFamily?: boolean;
  ticketNumber?: string;
}

export default function SecurityGuardLiveGatePage() {
  const [passInput, setPassInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedEntry, setVerifiedEntry] = useState<VerifiedEntry | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isExiting, setIsExiting] = useState(false);
  const [pendingStaffPassForExit, setPendingStaffPassForExit] = useState<string | null>(null);

  // QR Scanner Modal State
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scannerDefaultMode, setScannerDefaultMode] = useState<"camera" | "upload">("upload");
  const [isDirectScanningFile, setIsDirectScanningFile] = useState(false);
  const [autoVerifyOnScan, setAutoVerifyOnScan] = useState(true);
  const [scannedBadge, setScannedBadge] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [entryPhotoUrl, setEntryPhotoUrl] = useState<string | null>(null);
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);

  const directFileInputRef = useRef<HTMLInputElement | null>(null);

  // Verifying a pass records the entry and exhausts/expires the single-use QR / OTP pass.
  const executeVerification = useCallback(
    async (inputOverride?: string, hint?: ParsedQrData) => {
      const raw = (inputOverride !== undefined ? inputOverride : passInput).trim();
      if (!raw) {
        setErrorMessage("Please enter a PIN code or scan a QR pass to verify.");
        return;
      }
      if (raw.length < 4) {
        setErrorMessage("PIN code or pass token must be at least 4 characters.");
        return;
      }

      // Extract details if JSON string or structured payload
      let parsedPayload = hint;
      if (!parsedPayload) {
        parsedPayload = parseQrPayload(raw);
      }

      const extractedPin = parsedPayload?.pin || "";
      const extractedToken = parsedPayload?.token || "";
      const extractedCategory = parsedPayload?.category || "";
      const extractedReason = parsedPayload?.reason || "";
      const hintVisitorName = parsedPayload?.visitorName || "";
      const hintUnitLabel = parsedPayload?.unitLabel || "";

      // 1. Domestic Staff Pass Check
      const isStaffPass =
        parsedPayload?.type === "staff" ||
        raw.startsWith("GSE:STAFF:") ||
        raw.includes(":STAFF:") ||
        raw.startsWith("STAFF-") ||
        raw.startsWith("PASS-STAFF-");

      if (isStaffPass) {
        setIsVerifying(true);
        setErrorMessage("");
        setSuccessMessage("");
        setVerifiedEntry(null);
        setPendingStaffPassForExit(null);
        try {
          const res = await domesticStaffApi.verifyPass({ pass_code: raw, action: "check_in" });
          const staff = res?.staff;
          const att = res?.attendance;
          setVerifiedEntry({
            entryId: String(att?.id || staff?.id || ""),
            visitorName: staff?.full_name || hintVisitorName || "Domestic Staff",
            category: `Domestic Staff (${staff?.staff_type ? String(staff.staff_type).replace(/_/g, " ") : "Service"})`,
            reason: `Household Staff Service · ID: ${staff?.id_type ? String(staff.id_type).toUpperCase() : "VERIFIED"} · Phone: ${staff?.phone || "N/A"}`,
            unitLabel: "Assigned Community Units",
            vehicleNumber: null,
            status: "checked_in",
            enteredAt: String(att?.check_in_at || new Date().toISOString()),
            isStaff: true,
          });
          setSuccessMessage(`✅ Staff Entry Permitted & Attendance Logged for ${staff?.full_name || "Staff"}. Assigned residents notified.`);
          setPassInput("");
          setScannedBadge(null);
        } catch (err: any) {
          const code = err?.code || "";
          const msg = err?.message || "Invalid staff pass";
          if (code === "ALREADY_INSIDE" || msg.includes("already checked in")) {
            setPendingStaffPassForExit(raw);
            setErrorMessage(`⚠️ Staff member is already checked in. Click "Check Out Staff Member Now" below to record exit.`);
          } else if (code === "STAFF_BLACKLISTED" || msg.includes("blacklist")) {
            setErrorMessage(`🚨 STAFF ENTRY BLOCKED: Staff member is on the security blacklist.`);
          } else if (code === "STAFF_INACTIVE") {
            setErrorMessage(`❌ STAFF ENTRY DENIED: Staff profile is marked inactive.`);
          } else {
            setErrorMessage(`❌ STAFF ENTRY DENIED: ${msg}`);
          }
        }
        setIsVerifying(false);
        return;
      }

      // 2. Vendor / Technician Pass Check
      const isVendorPass =
        parsedPayload?.type === "vendor" ||
        raw.startsWith("GS-PASS-") ||
        raw.startsWith("PASS-VEN-") ||
        raw.startsWith("PASS-TKT-") ||
        raw.startsWith("VEN-") ||
        raw.includes("TKT-");

      if (isVendorPass) {
        setIsVerifying(true);
        setErrorMessage("");
        setSuccessMessage("");
        setVerifiedEntry(null);
        setPendingStaffPassForExit(null);
        try {
          let ticketNumber = "Authorized Work Order";
          const match = raw.match(/TKT-\d+/i);
          if (match) {
            ticketNumber = match[0].toUpperCase();
          } else if (extractedReason) {
            ticketNumber = extractedReason;
          }

          let eventId = `vendor-gate-${Date.now()}`;
          try {
            const eventRes: any = await gateApi.logEvent({
              event_type: "visitor_in",
              reference_type: "service_ticket",
              metadata: {
                ticket_number: ticketNumber,
                pass_code: raw,
                visitor_type: "vendor_technician",
              },
            });
            if (eventRes?.id) eventId = String(eventRes.id);
          } catch {
            // Non-fatal if gate event creation fails or offline
          }

          setVerifiedEntry({
            entryId: eventId,
            visitorName: hintVisitorName || "Vendor / Service Technician",
            category: extractedCategory || "Vendor / Service Technician",
            reason: extractedReason || `Authorized Work Order (${ticketNumber})`,
            unitLabel: hintUnitLabel || "Assigned Facility / Unit",
            vehicleNumber: null,
            status: "admitted",
            enteredAt: new Date().toISOString(),
            isVendor: true,
            ticketNumber,
          });
          setSuccessMessage(`✅ Vendor Technician Entry Approved for ${ticketNumber}. Entry logged to Gate Operations.`);
          setPassInput("");
          setScannedBadge(null);
        } catch (err: any) {
          setErrorMessage(`❌ VENDOR ENTRY DENIED: ${err?.message || "Invalid vendor pass"}`);
        }
        setIsVerifying(false);
        return;
      }

      // 3. Delivery Pass Check
      const isDeliveryPass =
        parsedPayload?.type === "delivery" ||
        raw.startsWith("DEL-") ||
        raw.startsWith("DELIVERY-") ||
        raw.startsWith("PASS-DEL-");

      if (isDeliveryPass) {
        setIsVerifying(true);
        setErrorMessage("");
        setSuccessMessage("");
        setVerifiedEntry(null);
        setPendingStaffPassForExit(null);
        try {
          let eventId = `delivery-gate-${Date.now()}`;
          try {
            const eventRes: any = await gateApi.logEvent({
              event_type: "delivery_in",
              reference_type: "delivery",
              metadata: {
                tracking_code: raw,
              },
            });
            if (eventRes?.id) eventId = String(eventRes.id);
          } catch {
            // Non-fatal
          }

          setVerifiedEntry({
            entryId: eventId,
            visitorName: hintVisitorName || "Delivery Executive",
            category: extractedCategory || "Courier / Delivery",
            reason: extractedReason || `Package Delivery (${raw})`,
            unitLabel: hintUnitLabel || "Resident Unit",
            vehicleNumber: null,
            status: "admitted",
            enteredAt: new Date().toISOString(),
            isDelivery: true,
          });
          setSuccessMessage(`✅ Delivery Entry Approved for ${raw}. Gate entry recorded.`);
          setPassInput("");
          setScannedBadge(null);
        } catch (err: any) {
          setErrorMessage(`❌ DELIVERY ENTRY DENIED: ${err?.message || "Invalid delivery pass"}`);
        }
        setIsVerifying(false);
        return;
      }

      // 3b. Family Member Permanent Pass Check
      const isFamilyPass =
        parsedPayload?.type === "family" ||
        raw.startsWith("GSE:FAMILY:") ||
        raw.startsWith("GSE-FAM-") ||
        raw.startsWith("PASS-FAM-");

      if (isFamilyPass) {
        setIsVerifying(true);
        setErrorMessage("");
        setSuccessMessage("");
        setVerifiedEntry(null);
        setPendingStaffPassForExit(null);
        try {
          const res = await residentsApi.verifyFamilyPass({ pass_code: raw });
          setVerifiedEntry({
            entryId: res.event_id || `family-gate-${Date.now()}`,
            visitorName: res.full_name,
            category: "Family Member (Household)",
            reason: `Permanent Resident Access · Relationship: ${res.relationship} · Pre-Approved`,
            unitLabel: res.unit_number ? `Unit ${res.unit_number}` : "Resident Household Unit",
            vehicleNumber: null,
            status: "admitted",
            enteredAt: new Date().toISOString(),
            isFamily: true,
          });
          setSuccessMessage(`✅ Family Entry Permitted: ${res.full_name} (${res.relationship}) from Unit ${res.unit_number}. Gate pass recorded.`);
          setPassInput("");
          setScannedBadge(null);
        } catch (err: any) {
          setErrorMessage(`❌ FAMILY ENTRY DENIED: ${err?.message || "Invalid family pass or access disabled"}`);
        }
        setIsVerifying(false);
        return;
      }

      // 4. Resident Visitor Pass / PIN Check
      const cleanDigits = raw.replace(/^(OTP|PIN|PASS)-?/i, "").trim();
      const tokenToUse = extractedToken || (raw.startsWith("QR-") ? raw.replace(/^QR-/, "") : "");
      const pinToUse = extractedPin || (/^\d{4,12}$/.test(cleanDigits) ? cleanDigits : "");
      const isPin = Boolean(pinToUse) && !tokenToUse;

      // Visitor gate admittance requires mandatory photograph
      if (!entryPhotoUrl && cleanDigits.length !== 10) {
        setShowPhotoPrompt(true);
        setErrorMessage(
          "📸 VISITOR PHOTO REQUIRED: Security policy mandates capturing a visitor photograph before gate entry. Please attach or snap the visitor's photo below.",
        );
        return;
      }

      setIsVerifying(true);
      setErrorMessage("");
      setSuccessMessage("");
      setVerifiedEntry(null);
      setPendingStaffPassForExit(null);

      try {
        const payload: Record<string, unknown> = isPin ? { pin: pinToUse } : { pass_token: tokenToUse || raw };
        if (entryPhotoUrl) {
          payload.entry_photo_url = entryPhotoUrl;
        }
        let entry: any = null;
        try {
          entry = await visitorsApi.recordEntry(payload);
        } catch (visErr: any) {
          if (
            visErr?.code === "PHOTO_REQUIRED" ||
            visErr?.message?.toLowerCase().includes("photo")
          ) {
            setShowPhotoPrompt(true);
            setErrorMessage(
              "📸 VISITOR PHOTO REQUIRED: Community policy mandates visitor photograph before gate entry. Please attach photo below.",
            );
            setIsVerifying(false);
            return;
          }
          // Fallback: If 6-digit PIN or phone was entered, try family member pass lookup
          try {
            const famRes = await residentsApi.verifyFamilyPass({ pass_code: raw });
            setVerifiedEntry({
              entryId: famRes.event_id || `family-gate-${Date.now()}`,
              visitorName: famRes.full_name,
              category: "Family Member (Household)",
              reason: `Permanent Resident Access · Relationship: ${famRes.relationship} · Pre-Approved`,
              unitLabel: famRes.unit_number ? `Unit ${famRes.unit_number}` : "Resident Household Unit",
              vehicleNumber: null,
              status: "admitted",
              enteredAt: new Date().toISOString(),
              isFamily: true,
            });
            setSuccessMessage(`✅ Family Entry Permitted: ${famRes.full_name} (${famRes.relationship}) from Unit ${famRes.unit_number}. Gate pass recorded.`);
            setPassInput("");
            setScannedBadge(null);
            setIsVerifying(false);
            return;
          } catch {
            // Not a family pass
          }

          // Fallback: If 10-digit mobile number was entered, try domestic staff lookup by phone
          if (cleanDigits.length === 10 || cleanDigits.length === 12) {
            try {
              const res = await domesticStaffApi.verifyPass({ pass_code: cleanDigits, action: "check_in" });
              const staff = res?.staff;
              const att = res?.attendance;
              setVerifiedEntry({
                entryId: String(att?.id || staff?.id || ""),
                visitorName: staff?.full_name || "Domestic Staff",
                category: `Domestic Staff (${staff?.staff_type ? String(staff.staff_type).replace(/_/g, " ") : "Service"})`,
                reason: `Household Staff Service · Phone: ${staff?.phone || cleanDigits}`,
                unitLabel: "Assigned Community Units",
                vehicleNumber: null,
                status: "checked_in",
                enteredAt: String(att?.check_in_at || new Date().toISOString()),
                isStaff: true,
              });
              setSuccessMessage(`✅ Staff Entry Permitted & Attendance Logged for ${staff?.full_name || "Staff"}.`);
              setPassInput("");
              setScannedBadge(null);
              setIsVerifying(false);
              return;
            } catch {
              // Re-throw original visitor error
            }
          }
          throw visErr;
        }

        let visitorName = hintVisitorName || "Guest Visitor";
        let unitLabel = hintUnitLabel || "Resident Unit";
        let category = extractedCategory || "Guest";
        let reason = extractedReason || "Visitor Entry";
        let vehicleNumber = (entry?.vehicle_number as string | null) || null;

        try {
          if (entry?.request_id) {
            const request: any = await visitorsApi.getRequest(String(entry.request_id));
            if (request) {
              if (request.purpose) reason = String(request.purpose);
              if (request.visitor_type) category = String(request.visitor_type).replace(/_/g, " ");
              if (request.vehicle_number) vehicleNumber = String(request.vehicle_number);
              else if (request.visitor?.vehicle_number) vehicleNumber = String(request.visitor.vehicle_number);
              unitLabel =
                (request.group_label as string) ||
                (request.unit_id ? `Unit ${String(request.unit_id).slice(0, 6)}` : unitLabel);
              if (request.visitor_id) {
                const directory = await visitorsApi.directory({ q: undefined });
                const match = (directory || []).find((v: any) => v.id === request.visitor_id);
                if (match) {
                  visitorName = (match as any).full_name || visitorName;
                  if (!vehicleNumber && (match as any).vehicle_number) {
                    vehicleNumber = String((match as any).vehicle_number);
                  }
                }
              }
            }
          }
        } catch {
          // Non-fatal if detail lookup fails
        }

        setVerifiedEntry({
          entryId: String(entry?.id || ""),
          visitorName,
          category,
          reason,
          unitLabel,
          vehicleNumber: vehicleNumber || null,
          status: String(entry?.status || "admitted"),
          enteredAt: String(entry?.entry_at || new Date().toISOString()),
        });
        setSuccessMessage(`✅ Entry Approved & Recorded for ${visitorName} — QR/OTP is now EXPIRED.`);
        setPassInput("");
        setScannedBadge(null);
        setEntryPhotoUrl(null);
        setShowPhotoPrompt(false);
      } catch (err: any) {
        const msg = err?.message || "Invalid pass / PIN, or visitor is blacklisted";
        setErrorMessage(`❌ NO ENTRY ALLOWED: ${msg}`);
      }
      setIsVerifying(false);
    },
    [passInput, entryPhotoUrl]
  );

  const handleVerifyPass = (e: React.FormEvent) => {
    e.preventDefault();
    executeVerification();
  };

  // Called when QR code is decoded from Modal (Camera or Upload)
  const handleQrDecoded = (raw: string, parsed: ParsedQrData) => {
    setPassInput(raw);
    const displayLabel = parsed.token ? `Token: ${parsed.token}` : parsed.pin ? `PIN: ${parsed.pin}` : raw;
    setScannedBadge(displayLabel);
    setErrorMessage("");

    if (autoVerifyOnScan) {
      executeVerification(raw, parsed);
    } else {
      setSuccessMessage(`✓ QR code successfully read: ${displayLabel}. Click "Verify & Allow Entry" to admit.`);
    }
  };

  // Handle direct file upload from the inline button or drag & drop
  const handleProcessImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file (PNG, JPG, JPEG, WEBP, or screenshot).");
      return;
    }

    setIsDirectScanningFile(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await decodeQrFromFile(file);
      if (result.success && result.data) {
        const parsed = result.parsed || parseQrPayload(result.data);
        setPassInput(result.data);
        const displayLabel = parsed.token
          ? `Token: ${parsed.token}`
          : parsed.pin
          ? `PIN: ${parsed.pin}`
          : result.data;
        setScannedBadge(displayLabel);

        if (autoVerifyOnScan) {
          await executeVerification(result.data, parsed);
        } else {
          setSuccessMessage(
            `✓ QR Code scanned from image: ${displayLabel}. Click "Verify & Allow Entry" to admit.`
          );
        }
      } else {
        setErrorMessage(
          result.error ||
            "No QR code found in the uploaded image. Please ensure the QR code is clearly visible, well-lit, and in focus."
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to scan QR code from file.");
    } finally {
      setIsDirectScanningFile(false);
      if (directFileInputRef.current) {
        directFileInputRef.current.value = "";
      }
    }
  };

  const handleRecordExit = async () => {
    if (!verifiedEntry) return;
    setIsExiting(true);
    try {
      if (verifiedEntry.isStaff) {
        await domesticStaffApi.checkOut(verifiedEntry.entryId);
      } else if (verifiedEntry.isVendor) {
        try {
          await gateApi.logEvent({
            event_type: "visitor_out",
            reference_type: "service_ticket",
            metadata: {
              ticket_number: verifiedEntry.ticketNumber,
              entry_id: verifiedEntry.entryId,
              visitor_type: "vendor_technician",
            },
          });
        } catch {
          // Non-fatal
        }
      } else if (verifiedEntry.isDelivery) {
        try {
          await gateApi.logEvent({
            event_type: "delivery_out",
            reference_type: "delivery",
            metadata: { entry_id: verifiedEntry.entryId },
          });
        } catch {
          // Non-fatal
        }
      } else {
        await visitorsApi.recordExit(verifiedEntry.entryId);
      }
      toast.success(`Exit recorded for ${verifiedEntry.visitorName}`);
      setVerifiedEntry(null);
      setPassInput("");
      setScannedBadge(null);
      setSuccessMessage(`✓ Exit recorded successfully for ${verifiedEntry.visitorName}.`);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to record exit.");
    }
    setIsExiting(false);
  };

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Live Security Gate Verification Console"
        subtitle="Pass / PIN verification doubles as entry recording, with blacklist screening enforced server-side"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Live Gate" }]}
      />

      {/* Hidden file input for fast 1-click QR image upload */}
      <input
        ref={directFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleProcessImageFile(e.target.files[0]);
          }
        }}
      />

      {/* Pass Verification Form Card */}
      <div
        className="card"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingFile(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDraggingFile(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingFile(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleProcessImageFile(e.dataTransfer.files[0]);
          }
        }}
        style={{
          marginBottom: "1.75rem",
          background: isDraggingFile
            ? "var(--primary-light)"
            : "linear-gradient(135deg, #ffffff, #f8fafc)",
          border: isDraggingFile ? "2px dashed var(--brand-primary)" : "1px solid var(--border-standard)",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            🔍 Verify & Record Entry (QR Token or PIN)
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.85rem", color: "var(--brand-body)", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={autoVerifyOnScan}
                onChange={(e) => setAutoVerifyOnScan(e.target.checked)}
                style={{ accentColor: "var(--brand-primary)", cursor: "pointer" }}
              />
              <span style={{ fontWeight: 600 }}>Auto-verify on QR scan</span>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsWalkInModalOpen(true)}
              style={{ padding: "0.45rem 1rem", fontSize: "0.85rem", fontWeight: 700, background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}
            >
              👤 Walk-In Check-In (Notify Resident)
            </button>
          </div>
        </div>

        {/* Form and Input */}
        <form
          onSubmit={handleVerifyPass}
          style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Scan QR token or enter 4-12 digit PIN..."
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              style={{
                fontSize: "1.05rem",
                padding: "0.75rem 1rem",
                fontWeight: 600,
                fontFamily: "monospace",
              }}
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isVerifying || isDirectScanningFile || !passInput.trim()}
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", fontWeight: 700 }}
          >
            {isVerifying ? "Verifying…" : "VERIFY & ALLOW ENTRY"}
          </button>
        </form>

        {/* QR Scanning Action Toolbar */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: "1.1rem",
            paddingTop: "1rem",
            borderTop: "1px solid #f1f5f9",
          }}
        >
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            QR Code Scan:
          </span>

          {/* Upload & Scan Button (Direct File Picker) */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => directFileInputRef.current?.click()}
            disabled={isDirectScanningFile || isVerifying}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 700,
              fontSize: "0.9rem",
              padding: "0.55rem 1rem",
              background: "#ffffff",
            }}
            title="Upload an image of a QR code to decode and verify"
          >
            {isDirectScanningFile ? (
              <>
                <span className="spinner" style={{ width: "14px", height: "14px" }} />
                Scanning Image…
              </>
            ) : (
              <>📁 Upload & Scan QR Image</>
            )}
          </button>

          {/* Live Camera Scanner Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setScannerDefaultMode("camera");
              setIsScannerModalOpen(true);
            }}
            disabled={isVerifying || isDirectScanningFile}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 700,
              fontSize: "0.9rem",
              padding: "0.55rem 1rem",
              background: "#ffffff",
            }}
            title="Scan QR code live using webcam or device camera"
          >
            📷 Live Camera Scanner
          </button>

          {/* Advanced Scan Dialog */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setScannerDefaultMode("upload");
              setIsScannerModalOpen(true);
            }}
            disabled={isVerifying || isDirectScanningFile}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 600,
              fontSize: "0.85rem",
              padding: "0.55rem 0.85rem",
              color: "var(--brand-body)",
            }}
          >
            🔍 Scan Dialog / Drag & Drop
          </button>

          {/* Drag & Drop hint */}
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: "auto" }}>
            💡 Tip: You can also drag & drop a QR image directly onto this card
          </span>
        </div>

        {/* Scanned Badge */}
        {scannedBadge && (
          <div
            style={{
              marginTop: "0.75rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.4rem 0.8rem",
              borderRadius: "6px",
              background: "var(--brand-primary-light)",
              border: "1px solid #bfdbfe",
              fontSize: "0.85rem",
              color: "var(--brand-primary)",
              fontWeight: 600,
            }}
          >
            <span>🎯 Decoded QR:</span>
            <code style={{ fontWeight: 700 }}>{scannedBadge}</code>
            <button
              type="button"
              onClick={() => {
                setScannedBadge(null);
                setPassInput("");
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0 2px",
                fontSize: "0.9rem",
                color: "var(--brand-primary)",
              }}
              title="Clear"
            >
              ✕
            </button>
          </div>
        )}

        {/* Visitor Photograph Attachment (Supports Policy Enforcement & Guard Manual Capture) */}
        <div
          style={{
            marginTop: "1.1rem",
            padding: "0.85rem 1.1rem",
            background: showPhotoPrompt ? "#fff7ed" : "#f8fafc",
            borderRadius: "8px",
            border: showPhotoPrompt ? "1.5px solid #f97316" : "1px solid #e2e8f0",
            transition: "all 0.2s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: showPhotoPrompt ? "#c2410c" : "#334155",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              📷 Visitor Entry Photograph <span style={{ color: "#dc2626", fontWeight: 900 }}>* (Mandatory)</span>{" "}
              {showPhotoPrompt && (
                <span
                  style={{
                    color: "#dc2626",
                    background: "#fee2e2",
                    padding: "0.15rem 0.45rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                  }}
                >
                  Required Before Entry
                </span>
              )}
            </span>
            {entryPhotoUrl && (
              <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 700 }}>
                ✓ Photograph Captured & Attached
              </span>
            )}
          </div>
          <FileUpload
            kind="visitor_photo"
            label="Upload or snap visitor photograph before admitting entry"
            currentUrl={entryPhotoUrl || undefined}
            onUploadComplete={(url) => {
              setEntryPhotoUrl(url);
              setErrorMessage("");
              toast.success("Visitor photograph attached successfully");
            }}
          />
        </div>

        {errorMessage && (
          <div
            style={{
              marginTop: "1.25rem",
              padding: "1rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--danger-light)",
              border: "1px solid var(--danger-border)",
              color: "#991b1b",
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            <div>{errorMessage}</div>
            {pendingStaffPassForExit && (
              <div style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isVerifying}
                  style={{
                    fontWeight: 700,
                    color: "#991B1B",
                    borderColor: "#FECACA",
                    background: "#FFFFFF",
                    padding: "0.5rem 1rem",
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    setIsVerifying(true);
                    try {
                      const res = await domesticStaffApi.verifyPass({
                        pass_code: pendingStaffPassForExit,
                        action: "check_out",
                      });
                      setSuccessMessage(`✓ Staff Exit Recorded successfully for ${res.staff?.full_name || "Staff"}.`);
                      setPendingStaffPassForExit(null);
                      setErrorMessage("");
                      setPassInput("");
                      setScannedBadge(null);
                    } catch (exitErr: any) {
                      setErrorMessage(`Failed to check out staff: ${exitErr?.message || "Error"}`);
                    } finally {
                      setIsVerifying(false);
                    }
                  }}
                >
                  🚪 Check Out Staff Member Now
                </button>
              </div>
            )}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              marginTop: "1.25rem",
              padding: "1rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--success-light)",
              border: "1px solid var(--success-border)",
              color: "#065f46",
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            {successMessage}
          </div>
        )}
      </div>

      {/* Verification Result Card */}
      {verifiedEntry && (
        <div
          className="card"
          style={{ marginBottom: "1.75rem", border: "2px solid var(--success-border)", background: "#ffffff" }}
        >
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem" }}>
                {verifiedEntry.isFamily ? "👨‍👩‍👧‍👦" : verifiedEntry.isStaff ? "👷" : verifiedEntry.isVendor ? "🔧" : verifiedEntry.isDelivery ? "📦" : "🎟️"}
              </span>
              <h3 className="card-title" style={{ margin: 0 }}>
                {verifiedEntry.isFamily
                  ? "Pre-Approved Family Member Gate Entry"
                  : verifiedEntry.isStaff
                  ? "Domestic Staff Gate Entry Admitted"
                  : verifiedEntry.isVendor
                  ? "Vendor Technician Gate Entry Admitted"
                  : verifiedEntry.isDelivery
                  ? "Delivery Agent Gate Entry Admitted"
                  : "Gate Entry Admitted & Pass Expired"}
              </h3>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span
                style={{
                  padding: "0.25rem 0.6rem",
                  borderRadius: "6px",
                  background: verifiedEntry.isFamily
                    ? "#ECFDF5"
                    : verifiedEntry.isStaff
                    ? "#EFF6FF"
                    : verifiedEntry.isVendor
                    ? "#FDF4FF"
                    : verifiedEntry.isDelivery
                    ? "#FFFBEB"
                    : "#FEF2F2",
                  color: verifiedEntry.isFamily
                    ? "#065F46"
                    : verifiedEntry.isStaff
                    ? "#1D4ED8"
                    : verifiedEntry.isVendor
                    ? "#86198F"
                    : verifiedEntry.isDelivery
                    ? "#B45309"
                    : "#991B1B",
                  fontWeight: 700,
                  fontSize: "11.5px",
                  border: verifiedEntry.isFamily
                    ? "1px solid #A7F3D0"
                    : verifiedEntry.isStaff
                    ? "1px solid #DBEAFE"
                    : verifiedEntry.isVendor
                    ? "1px solid #F5D0FE"
                    : verifiedEntry.isDelivery
                    ? "1px solid #FDE68A"
                    : "1px solid #FECACA",
                }}
              >
                {verifiedEntry.isFamily
                  ? "♾️ PERMANENT FAMILY PASS"
                  : verifiedEntry.isStaff
                  ? "🛡️ DIGITAL STAFF PASS"
                  : verifiedEntry.isVendor
                  ? "🔧 VENDOR WORK ORDER"
                  : verifiedEntry.isDelivery
                  ? "📦 COURIER ENTRY"
                  : "🔒 SINGLE-USE EXPIRED"}
              </span>
              <StatusBadge status={verifiedEntry.status} />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1.25rem",
              marginTop: "1rem",
              marginBottom: "1.5rem",
              padding: "1rem",
              background: "#F8FAFC",
              borderRadius: "8px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                {verifiedEntry.isFamily
                  ? "Family Member"
                  : verifiedEntry.isStaff
                  ? "Staff Member"
                  : verifiedEntry.isVendor
                  ? "Technician / Vendor"
                  : verifiedEntry.isDelivery
                  ? "Delivery Agent"
                  : "Visitor Name"}
              </div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--brand-heading)", marginTop: "0.2rem" }}>
                {verifiedEntry.visitorName}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Category</div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--brand-primary)", marginTop: "0.2rem", textTransform: "capitalize" }}>
                {verifiedEntry.category || "Guest"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Reason / Purpose</div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--brand-heading)", marginTop: "0.2rem" }}>
                {verifiedEntry.reason || "Visitor Entry"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Destination / Unit</div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--brand-heading)", marginTop: "0.2rem" }}>
                {verifiedEntry.unitLabel}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Vehicle Number</div>
              <div style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.95rem", marginTop: "0.2rem" }}>
                {verifiedEntry.vehicleNumber || "N/A (Pedestrian)"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Entry Time</div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#065F46", marginTop: "0.2rem" }}>
                {verifiedEntry.enteredAt ? new Date(verifiedEntry.enteredAt).toLocaleTimeString() : "Just now"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              className="btn btn-secondary"
              style={{ padding: "0.6rem 1.25rem", fontSize: "0.95rem", fontWeight: 600 }}
              onClick={() => {
                setVerifiedEntry(null);
                setSuccessMessage("");
                setErrorMessage("");
                setScannedBadge(null);
              }}
            >
              {verifiedEntry.isStaff ? "✓ Next Pass / Scan" : "✓ Next Visitor / Scan"}
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: "0.6rem 1.5rem", fontSize: "0.95rem", fontWeight: 700, color: "#991B1B", borderColor: "#FECACA" }}
              onClick={handleRecordExit}
              disabled={isExiting}
            >
              🚪 {isExiting ? "Recording…" : verifiedEntry.isStaff ? "CHECK OUT STAFF NOW" : "RECORD EXIT NOW"}
            </button>
          </div>
        </div>
      )}

      {/* QR Scanner Modal (Upload & Live Camera) */}
      <QrScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onScan={handleQrDecoded}
        defaultMode={scannerDefaultMode}
      />

      {/* Walk-in Visitor Modal (Guard enters mobile/details -> pushes instant prompt to resident) */}
      <WalkInVisitorModal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        onEntryAdmitted={(entry) => {
          setIsWalkInModalOpen(false);
          setSuccessMessage("✅ Walk-in Visitor Entry Permitted & Recorded.");
          setVerifiedEntry({
            entryId: String(entry?.id || ""),
            visitorName: "Walk-in Visitor",
            unitLabel: "Resident Unit",
            status: "inside",
            enteredAt: new Date().toISOString(),
          });
        }}
      />
    </div>
  );
}
