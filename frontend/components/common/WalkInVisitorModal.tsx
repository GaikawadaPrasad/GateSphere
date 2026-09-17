"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { FileUpload } from "@/components/common/FileUpload";
import { visitorsApi, communitiesApi, authApi, blacklistApi } from "@/lib/api";
import { useUiStore } from "@/store/ui";
import type { Unit } from "@/types/communities";

interface WalkInVisitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEntryAdmitted?: (entry: any) => void;
}

const VISITOR_CATEGORIES = [
  { value: "guest", label: "Personal Guest / Friend / Family" },
  { value: "cab_taxi", label: "Cab / Taxi (Uber, Ola, etc.)" },
  { value: "delivery_exec", label: "Delivery Executive (Courier / Food)" },
  { value: "service_tech", label: "Service Technician / Maintenance" },
  { value: "vendor", label: "Vendor / Contractor" },
  { value: "interviewee", label: "Interviewee / Job Applicant" },
  { value: "other", label: "Other Walk-in" },
];

const GOVT_ID_TYPES = [
  { value: "aadhaar", label: "Aadhaar Card (12 digits)" },
  { value: "pan", label: "PAN Card (10 chars)" },
  { value: "voter_id", label: "Voter ID" },
  { value: "driving_license", label: "Driving License" },
  { value: "passport", label: "Passport" },
  { value: "other", label: "Other Government ID" },
];

export function WalkInVisitorModal({
  isOpen,
  onClose,
  onEntryAdmitted,
}: WalkInVisitorModalProps) {
  // Form inputs
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [idType, setIdType] = useState("aadhaar");
  const [idNumber, setIdNumber] = useState("");
  const [unitId, setUnitId] = useState("");
  const [visitorType, setVisitorType] = useState("guest");
  const [purpose, setPurpose] = useState("Visitor at gate requesting entry");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [visitorPhotoUrl, setVisitorPhotoUrl] = useState<string | null>(null);

  // Blacklist screening state
  const [isCheckingBlacklist, setIsCheckingBlacklist] = useState(false);
  const [blacklistHit, setBlacklistHit] = useState<{
    reason: string;
    risk_level?: string;
  } | null>(null);

  // Data fetching
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitFilter, setUnitFilter] = useState("");
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  // Workflow states: 'form' | 'waiting_approval' | 'admitted'
  const [step, setStep] = useState<"form" | "waiting_approval" | "admitted">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Field-level validation state
  const [fieldErrors, setFieldErrors] = useState<{
    visitorName?: string;
    visitorPhone?: string;
    idNumber?: string;
    unitId?: string;
    vehicleNumber?: string;
    purpose?: string;
    visitorPhotoUrl?: string;
  }>({});
  const [touchedFields, setTouchedFields] = useState<{ [key: string]: boolean }>({});

  // Active request being tracked
  const [activeRequest, setActiveRequest] = useState<any | null>(null);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setVisitorName("");
      setVisitorPhone("");
      setIdType("aadhaar");
      setIdNumber("");
      setBlacklistHit(null);
      setUnitId("");
      setUnitFilter("");
      setVisitorType("guest");
      setPurpose("Visitor at gate requesting entry");
      setVehicleNumber("");
      setVisitorPhotoUrl(null);
      setErrorMessage(null);
      setFieldErrors({});
      setTouchedFields({});
      setUnitsError(null);
      setActiveRequest(null);
      loadUnits();
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen]);

  const validateField = (
    name: string,
    value: any,
    context?: { idType?: string }
  ): string | undefined => {
    switch (name) {
      case "visitorName": {
        const trimmed = (value || "").trim();
        if (!trimmed) return "Visitor full name is required.";
        if (trimmed.length < 2) return "Visitor name must be at least 2 characters.";
        if (trimmed.length > 100) return "Visitor name cannot exceed 100 characters.";
        if (!/^[a-zA-Z\s.\-']+$/.test(trimmed)) {
          return "Visitor name must contain valid letters only (no numbers or special symbols).";
        }
        return undefined;
      }
      case "visitorPhone": {
        const raw = (value || "").trim();
        if (!raw) return "Mobile number is required.";
        const cleaned = raw.replace(/[\s\-()]/g, "");
        if (!/^\+?[0-9]+$/.test(cleaned)) {
          return "Mobile number must contain digits only.";
        }
        let digits = cleaned;
        if (digits.startsWith("+91")) {
          digits = digits.slice(3);
        } else if (digits.startsWith("+")) {
          digits = digits.slice(1);
        } else if (digits.startsWith("0") && digits.length === 11) {
          digits = digits.slice(1);
        }

        if (digits.length === 10) {
          if (!/^[6-9]\d{9}$/.test(digits)) {
            return "Valid 10-digit mobile number must start with 6, 7, 8, or 9.";
          }
        } else if (cleaned.startsWith("+") && cleaned.length >= 11 && cleaned.length <= 15) {
          return undefined;
        } else {
          return "Mobile number must be a valid 10-digit number (e.g. 9876543210 or +91 9876543210).";
        }
        return undefined;
      }
      case "idNumber": {
        const raw = (value || "").trim();
        if (!raw) return undefined; // Optional field
        const currentIdType = context?.idType || idType;
        const cleanVal = raw.toUpperCase().replace(/[\s\-]/g, "");
        if (currentIdType === "aadhaar") {
          if (!/^\d{12}$/.test(cleanVal)) {
            return "Aadhaar number must be exactly 12 numeric digits.";
          }
        } else if (currentIdType === "pan") {
          if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanVal)) {
            return "PAN must be 10 characters in format ABCDE1234F (5 letters, 4 digits, 1 letter).";
          }
        } else if (currentIdType === "driving_license") {
          if (!/^[A-Z0-9]{10,20}$/.test(cleanVal)) {
            return "Driving license must be 10-20 alphanumeric characters.";
          }
        } else if (currentIdType === "voter_id") {
          if (!/^[A-Z0-9]{8,16}$/.test(cleanVal)) {
            return "Voter ID must be 8-16 alphanumeric characters (e.g. ABC1234567).";
          }
        } else if (currentIdType === "passport") {
          if (!/^[A-Z][0-9]{7,8}$/.test(cleanVal) && !/^[A-Z0-9]{8,9}$/.test(cleanVal)) {
            return "Passport number must be 8-9 characters starting with a letter (e.g. A1234567).";
          }
        } else {
          if (cleanVal.length < 4 || cleanVal.length > 40) {
            return "Govt ID number must be between 4 and 40 characters.";
          }
        }
        return undefined;
      }
      case "unitId": {
        if (!value) return "Please select the destination unit/flat.";
        return undefined;
      }
      case "vehicleNumber": {
        const raw = (value || "").trim();
        if (!raw) return undefined; // Optional field
        const cleanVal = raw.toUpperCase().replace(/[\s\-]/g, "");
        if (!/^[A-Z0-9]{4,15}$/.test(cleanVal)) {
          return "Vehicle number must be 4-15 alphanumeric characters (e.g. TS09EA1234).";
        }
        return undefined;
      }
      case "purpose": {
        const trimmed = (value || "").trim();
        if (trimmed && (trimmed.length < 2 || trimmed.length > 255)) {
          return "Purpose must be between 2 and 255 characters.";
        }
        return undefined;
      }
      case "visitorPhotoUrl": {
        if (!value) {
          return "Visitor photograph is required by security policy before gate check-in.";
        }
        return undefined;
      }
      default:
        return undefined;
    }
  };

  const handleFieldChange = (name: string, value: any, context?: any) => {
    if (touchedFields[name] || fieldErrors[name as keyof typeof fieldErrors]) {
      const error = validateField(name, value, context);
      setFieldErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleFieldBlur = (name: string, value: any, context?: any) => {
    setTouchedFields((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, value, context);
    setFieldErrors((prev) => ({ ...prev, [name]: error }));
  };

  const { activeCommunityId } = useUiStore();

  const loadUnits = async (force = false) => {
    if (!force && units.length > 0) return;
    setIsLoadingUnits(true);
    setUnitsError(null);
    try {
      let cid: string | null = activeCommunityId || null;
      if (!cid) {
        const me = await authApi.me();
        cid = me?.community_ids?.[0] || (me as any)?.community_id || null;
        if (!cid && me?.roles && Array.isArray(me.roles)) {
          const matchedRole = me.roles.find((r: any) => r.community_id);
          cid = matchedRole ? matchedRole.community_id : null;
        }
      }
      if (!cid) {
        const comms: any = await communitiesApi.list({ active: true });
        const list = Array.isArray(comms) ? comms : comms?.data || comms?.items || [];
        if (list.length > 0) {
          cid = list[0].id;
        }
      }
      if (cid) {
        const res: any = await communitiesApi.communityUnits(cid, { page_size: 100 });
        const uList = Array.isArray(res) ? res : res?.data || res?.items || [];
        if (Array.isArray(uList) && uList.length > 0) {
          const sorted = [...uList].sort((a: any, b: any) =>
            (a.unit_number || "").localeCompare(b.unit_number || "", undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );
          setUnits(sorted);
          setUnitId((prev) => (prev && sorted.some((u: any) => u.id === prev) ? prev : ""));
        } else {
          setUnits([]);
        }
      } else {
        setUnitsError("Could not resolve community for security guard account.");
      }
    } catch (err: any) {
      console.error("Failed to load units for walk-in modal:", err);
      setUnitsError(err?.message || "Failed to load units. Please try again.");
    } finally {
      setIsLoadingUnits(false);
    }
  };

  // Start polling request status while in 'waiting_approval'
  useEffect(() => {
    if (step === "waiting_approval" && activeRequest?.id) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      pollIntervalRef.current = setInterval(async () => {
        try {
          const req: any = await visitorsApi.getRequest(activeRequest.id);
          if (req) {
            setActiveRequest((prev: any) => ({ ...prev, ...req }));
          }
        } catch {
          // ignore polling errors
        }
      }, 3000);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [step, activeRequest?.id]);

  const checkBlacklist = async (phoneToCheck?: string, idToCheck?: string) => {
    const rawP = (phoneToCheck !== undefined ? phoneToCheck : visitorPhone).trim();
    const rawI = (idToCheck !== undefined ? idToCheck : idNumber).trim();
    if (!rawP && !rawI) return;

    let cleanPhone = rawP.replace(/[\s\-()]/g, "");
    if (cleanPhone) {
      if (!cleanPhone.startsWith("+") && cleanPhone.length === 10) {
        cleanPhone = `+91${cleanPhone}`;
      } else if (!cleanPhone.startsWith("+") && cleanPhone.length > 10) {
        cleanPhone = `+${cleanPhone}`;
      }
    }

    try {
      setIsCheckingBlacklist(true);
      const res = await blacklistApi.check({
        phone: cleanPhone || undefined,
        id_number: rawI ? rawI.toUpperCase().replace(/[\s\-]/g, "") : undefined,
      });
      if (res && res.blacklisted) {
        setBlacklistHit({
          reason: res.reason || "Visitor is flagged on the security blacklist.",
          risk_level: res.risk_level || "high",
        });
      }
    } catch {
      // Ignored for fast pre-check; backend createRequest enforces strictly
    } finally {
      setIsCheckingBlacklist(false);
    }
  };

  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: { [key: string]: string } = {};
    const nameErr = validateField("visitorName", visitorName);
    if (nameErr) errors.visitorName = nameErr;
    const phoneErr = validateField("visitorPhone", visitorPhone);
    if (phoneErr) errors.visitorPhone = phoneErr;
    const idErr = validateField("idNumber", idNumber, { idType });
    if (idErr) errors.idNumber = idErr;
    const unitErr = validateField("unitId", unitId);
    if (unitErr) errors.unitId = unitErr;
    const vehErr = validateField("vehicleNumber", vehicleNumber);
    if (vehErr) errors.vehicleNumber = vehErr;
    const purposeErr = validateField("purpose", purpose);
    if (purposeErr) errors.purpose = purposeErr;
    const photoErr = validateField("visitorPhotoUrl", visitorPhotoUrl);
    if (photoErr) errors.visitorPhotoUrl = photoErr;

    setFieldErrors(errors);
    setTouchedFields({
      visitorName: true,
      visitorPhone: true,
      idNumber: true,
      unitId: true,
      vehicleNumber: true,
      purpose: true,
      visitorPhotoUrl: true,
    });

    if (Object.keys(errors).length > 0) {
      setErrorMessage("Please correct the highlighted validation errors before submitting.");
      return;
    }

    let cleanPhone = visitorPhone.trim().replace(/[\s\-()]/g, "");
    if (!cleanPhone.startsWith("+")) {
      if (cleanPhone.length === 10) {
        cleanPhone = `+91${cleanPhone}`;
      } else if (cleanPhone.startsWith("0") && cleanPhone.length === 11) {
        cleanPhone = `+91${cleanPhone.slice(1)}`;
      } else {
        cleanPhone = `+${cleanPhone}`;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const cleanId = idNumber.trim().toUpperCase().replace(/[\s\-]/g, "");
      const payload = {
        unit_id: unitId,
        visitor: {
          full_name: visitorName.trim(),
          phone: cleanPhone,
          id_type: cleanId ? idType : undefined,
          id_number: cleanId || undefined,
          vehicle_number: vehicleNumber.trim() || undefined,
          photo_url: visitorPhotoUrl || undefined,
        },
        visitor_type: visitorType,
        purpose: purpose.trim() || "Visitor at gate requesting entry",
        vehicle_number: vehicleNumber.trim() || undefined,
      };

      const res: any = await visitorsApi.createRequest(payload);
      setActiveRequest(res);
      setStep("waiting_approval");
    } catch (err: any) {
      console.error("Failed to initiate visitor approval request:", err);
      if (
        err?.code === "VISITOR_BLACKLISTED" ||
        (err?.message && err.message.toLowerCase().includes("blacklist"))
      ) {
        setBlacklistHit({
          reason:
          err?.fields?.reason ||
          err?.message ||
          "This visitor is flagged on the security blacklist.",
          risk_level: err?.fields?.risk_level || "high",
        });
        setErrorMessage("⛔ ENTRY DENIED: Visitor is blacklisted by community security!");
      } else {
        let detailMsg = err?.message || "Failed to initiate visitor approval request. Please check blacklist / unit status.";
        if (err?.fields && typeof err.fields === "object" && Object.keys(err.fields).length > 0) {
          const fieldDetails = Object.entries(err.fields)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ");
          detailMsg = `${detailMsg} (${fieldDetails})`;
        }
        setErrorMessage(detailMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdmitVisitor = async () => {
    if (!activeRequest?.id) return;
    if (!visitorPhotoUrl) {
      setErrorMessage(
        "📸 VISITOR PHOTO REQUIRED: Security policy mandates capturing a visitor photograph before gate admittance. Please attach the photo below."
      );
      return;
    }
    setIsAdmitting(true);
    setErrorMessage(null);
    try {
      const entry: any = await visitorsApi.recordEntry({
        request_id: activeRequest.id,
        vehicle_number: vehicleNumber.trim() || undefined,
        entry_photo_url: visitorPhotoUrl,
      });
      setStep("admitted");
      if (onEntryAdmitted) onEntryAdmitted(entry);
    } catch (err: any) {
      console.error("Failed to record gate entry:", err);
      let detailMsg = err?.message || "Failed to record gate entry.";
      if (err?.fields && typeof err.fields === "object" && Object.keys(err.fields).length > 0) {
        const fieldDetails = Object.entries(err.fields)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" | ");
        detailMsg = `${detailMsg} (${fieldDetails})`;
      }
      setErrorMessage(detailMsg);
    } finally {
      setIsAdmitting(false);
    }
  };

  const selectedUnit = units.find((u) => u.id === unitId);
  const filteredUnits = unitFilter.trim()
    ? units.filter((u) => (u.unit_number || "").toLowerCase().includes(unitFilter.toLowerCase().trim()))
    : units;

  const handleUnitFilterChange = (val: string) => {
    setUnitFilter(val);
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) {
      return;
    }
    const matches = units.filter((u) =>
      (u.unit_number || "").toLowerCase().includes(trimmed)
    );
    const exactMatch = matches.find(
      (u) => (u.unit_number || "").toLowerCase() === trimmed
    );
    if (exactMatch) {
      setUnitId(exactMatch.id);
      handleFieldChange("unitId", exactMatch.id);
    } else if (matches.length === 1) {
      setUnitId(matches[0].id);
      handleFieldChange("unitId", matches[0].id);
    } else if (unitId && !matches.some((u) => u.id === unitId)) {
      setUnitId("");
      handleFieldChange("unitId", "");
    }
  };

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === "form"
          ? "👤 Walk-In Visitor Gate Check-In"
          : step === "waiting_approval"
          ? "📲 Real-Time Resident Approval Prompt"
          : "✅ Visitor Admitted to Premises"
      }
      size="lg"
    >
      {errorMessage && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-sm)",
            background: "var(--danger-light)",
            border: "1px solid var(--danger-border)",
            color: "#991b1b",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {step === "form" && (
        <form onSubmit={handleSendPrompt} noValidate>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
            Visitor arrived at gate without a pre-approved pass. Enter mobile and details to trigger an instant approval prompt to the resident.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                Visitor Full Name <span style={{ color: "red" }}>*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Ramesh Kumar"
                value={visitorName}
                onChange={(e) => {
                  setVisitorName(e.target.value);
                  handleFieldChange("visitorName", e.target.value);
                }}
                onBlur={() => handleFieldBlur("visitorName", visitorName)}
                style={fieldErrors.visitorName ? { borderColor: "#EF4444", background: "#FEF2F2" } : undefined}
                required
              />
              {fieldErrors.visitorName && (
                <div style={{ color: "#DC2626", fontSize: "0.75rem", marginTop: "0.25rem", fontWeight: 600 }}>
                  {fieldErrors.visitorName}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                Mobile Number <span style={{ color: "red" }}>*</span>
              </label>
              <input
                type="number"
                className="input-field"
                placeholder="e.g. 98765 43210"
                value={visitorPhone}
                onChange={(e) => {
                  setVisitorPhone(e.target.value);
                  handleFieldChange("visitorPhone", e.target.value);
                }}
                onBlur={() => {
                  handleFieldBlur("visitorPhone", visitorPhone);
                  checkBlacklist(visitorPhone, undefined);
                }}
                style={fieldErrors.visitorPhone ? { borderColor: "#EF4444", background: "#FEF2F2" } : undefined}
                required
              />
              {fieldErrors.visitorPhone && (
                <div style={{ color: "#DC2626", fontSize: "0.75rem", marginTop: "0.25rem", fontWeight: 600 }}>
                  {fieldErrors.visitorPhone}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                Govt ID Type (Optional)
              </label>
              <select
                className="input-field"
                value={idType}
                onChange={(e) => {
                  const newType = e.target.value;
                  setIdType(newType);
                  if (idNumber.trim()) {
                    const idErr = validateField("idNumber", idNumber, { idType: newType });
                    setFieldErrors((prev) => ({ ...prev, idNumber: idErr }));
                  }
                }}
              >
                {GOVT_ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                  Govt ID Number (Aadhaar / PAN / DL)
                </label>
                {isCheckingBlacklist && (
                  <span style={{ fontSize: "0.75rem", color: "var(--primary)" }}>
                    🔍 Checking…
                  </span>
                )}
              </div>
              <input
                type="text"
                className="input-field"
                placeholder={
                  idType === "aadhaar"
                    ? "e.g. 1234 5678 9012 (12 digits)"
                    : idType === "pan"
                    ? "e.g. ABCDE1234F (10 chars)"
                    : "Enter Govt ID number"
                }
                value={idNumber}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setIdNumber(val);
                  handleFieldChange("idNumber", val, { idType });
                }}
                onBlur={() => {
                  handleFieldBlur("idNumber", idNumber, { idType });
                  checkBlacklist(undefined, idNumber);
                }}
                style={{
                  fontFamily: "monospace",
                  ...(fieldErrors.idNumber ? { borderColor: "#EF4444", background: "#FEF2F2" } : {}),
                }}
              />
              {fieldErrors.idNumber && (
                <div style={{ color: "#DC2626", fontSize: "0.75rem", marginTop: "0.25rem", fontWeight: 600 }}>
                  {fieldErrors.idNumber}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                  Destination Unit / Flat <span style={{ color: "red" }}>*</span>
                  {units.length > 0 && (
                    <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                      ({units.length} flats available)
                    </span>
                  )}
                </label>
                {unitsError && (
                  <button
                    type="button"
                    onClick={() => loadUnits(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontWeight: 600,
                    }}
                  >
                    🔄 Retry loading
                  </button>
                )}
              </div>

              {units.length > 6 && (
                <input
                  type="text"
                  placeholder="🔍 Filter flat e.g. A-101, B-2..."
                  value={unitFilter}
                  onChange={(e) => handleUnitFilterChange(e.target.value)}
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.35rem 0.6rem",
                    marginBottom: "0.4rem",
                    width: "100%",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                  }}
                />
              )}

              <select
                className="input-field"
                value={unitId}
                onChange={(e) => {
                  const val = e.target.value;
                  setUnitId(val);
                  handleFieldChange("unitId", val);
                }}
                onBlur={() => handleFieldBlur("unitId", unitId)}
                style={fieldErrors.unitId ? { borderColor: "#EF4444", background: "#FEF2F2" } : undefined}
                disabled={isLoadingUnits}
                required
              >
                {isLoadingUnits ? (
                  <option value="">⏳ Loading flats in community...</option>
                ) : unitsError ? (
                  <option value="">⚠️ Error loading flats — click Retry above</option>
                ) : filteredUnits.length === 0 ? (
                  <option value="">
                    {units.length === 0 ? "No units registered in community" : `No units match "${unitFilter}"`}
                  </option>
                ) : (
                  <>
                    <option value="">
                      {unitFilter.trim()
                        ? `-- Select Destination Flat (${filteredUnits.length} matching) --`
                        : "-- Select Destination Unit / Flat --"}
                    </option>
                    {filteredUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unit {u.unit_number} {u.unit_type ? `(${u.unit_type})` : ""}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {selectedUnit && (
                <div
                  style={{
                    marginTop: "0.35rem",
                    padding: "0.3rem 0.5rem",
                    borderRadius: "4px",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    color: "#166534",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>📍 Target Flat: <strong>Unit {selectedUnit.unit_number}</strong> {selectedUnit.unit_type ? `(${selectedUnit.unit_type})` : ""}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUnitId("");
                      setUnitFilter("");
                      handleFieldChange("unitId", "");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#991B1B",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                    title="Clear selection"
                  >
                    ✕ Clear
                  </button>
                </div>
              )}
              {fieldErrors.unitId && (
                <div style={{ color: "#DC2626", fontSize: "0.75rem", marginTop: "0.25rem", fontWeight: 600 }}>
                  {fieldErrors.unitId}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                Visitor Type / Category
              </label>
              <select
                className="input-field"
                value={visitorType}
                onChange={(e) => setVisitorType(e.target.value)}
              >
                {VISITOR_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                Vehicle Number (Optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. TS 09 EA 1234"
                value={vehicleNumber}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setVehicleNumber(val);
                  handleFieldChange("vehicleNumber", val);
                }}
                onBlur={() => handleFieldBlur("vehicleNumber", vehicleNumber)}
                style={{
                  fontFamily: "monospace",
                  ...(fieldErrors.vehicleNumber ? { borderColor: "#EF4444", background: "#FEF2F2" } : {}),
                }}
              />
              {fieldErrors.vehicleNumber && (
                <div style={{ color: "#DC2626", fontSize: "0.75rem", marginTop: "0.25rem", fontWeight: 600 }}>
                  {fieldErrors.vehicleNumber}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                Purpose / Remarks
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Meeting resident, Package drop"
                value={purpose}
                onChange={(e) => {
                  setPurpose(e.target.value);
                  handleFieldChange("purpose", e.target.value);
                }}
                onBlur={() => handleFieldBlur("purpose", purpose)}
                style={fieldErrors.purpose ? { borderColor: "#EF4444", background: "#FEF2F2" } : undefined}
              />
              {fieldErrors.purpose && (
                <div style={{ color: "#DC2626", fontSize: "0.75rem", marginTop: "0.25rem", fontWeight: 600 }}>
                  {fieldErrors.purpose}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              padding: "1rem",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: visitorPhotoUrl
                ? "1px solid #86EFAC"
                : fieldErrors.visitorPhotoUrl
                ? "1.5px solid #EF4444"
                : "1px solid #CBD5E1",
              marginBottom: "1.25rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem",
              }}
            >
              <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E293B" }}>
                📷 Visitor Photograph <span style={{ color: "#DC2626", fontWeight: 900 }}>* (Mandatory)</span>
              </label>
              {visitorPhotoUrl ? (
                <span style={{ fontSize: "0.75rem", color: "#16A34A", fontWeight: 700 }}>
                  ✓ Photograph Attached
                </span>
              ) : (
                <span style={{ fontSize: "0.75rem", color: "#DC2626", fontWeight: 700 }}>
                  Required Before Entry
                </span>
              )}
            </div>
            <FileUpload
              kind="visitor_photo"
              label="Upload or snap visitor face photograph"
              currentUrl={visitorPhotoUrl || undefined}
              onUploadComplete={(url) => {
                setVisitorPhotoUrl(url);
                setErrorMessage(null);
                setFieldErrors((prev) => ({ ...prev, visitorPhotoUrl: undefined }));
              }}
            />
            {fieldErrors.visitorPhotoUrl && (
              <div style={{ color: "#DC2626", fontSize: "0.75rem", marginTop: "0.4rem", fontWeight: 600 }}>
                {fieldErrors.visitorPhotoUrl}
              </div>
            )}
          </div>

          {errorMessage && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-sm)",
                background: "#FEF2F2",
                border: "1px solid #F87171",
                color: "#991B1B",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Sending Request…" : "📲 SEND APPROVAL PROMPT TO RESIDENT"}
            </button>
          </div>
        </form>
      )}

      {step === "waiting_approval" && activeRequest && (
        <div>
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "8px",
              background: activeRequest.status === "approved" ? "var(--success-light)" : activeRequest.status === "rejected" ? "var(--danger-light)" : "#EFF6FF",
              border: `1px solid ${activeRequest.status === "approved" ? "var(--success-border)" : activeRequest.status === "rejected" ? "var(--danger-border)" : "#BFDBFE"}`,
              marginBottom: "1.25rem",
              textAlign: "center",
            }}
          >
            {activeRequest.status === "pending" && (
              <>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#1E40AF" }}>
                  Awaiting Resident Decision
                </h4>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#3B82F6" }}>
                  Real-time prompt sent to the primary occupant of{" "}
                  <strong>Unit {selectedUnit?.unit_number || "Selected"}</strong>.
                  Polling for resident response...
                </p>
              </>
            )}

            {activeRequest.status === "approved" && (
              <>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎉</div>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#065F46" }}>
                  Resident Approved Entry!
                </h4>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#047857" }}>
                  The resident has permitted this visitor to enter the community.
                </p>
              </>
            )}

            {activeRequest.status === "rejected" && (
              <>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>❌</div>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#991B1B" }}>
                  Resident Denied Entry
                </h4>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#DC2626" }}>
                  The resident has rejected this entry request. Do not allow visitor through the gate.
                </p>
              </>
            )}
          </div>

          <div
            style={{
              background: "#F8FAFC",
              borderRadius: "8px",
              padding: "1rem 1.25rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "1rem",
              fontSize: "0.9rem",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Visitor</span>
              <strong>{visitorName}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Phone</span>
              <strong style={{ fontFamily: "monospace" }}>{visitorPhone}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Destination</span>
              <strong>Unit {selectedUnit?.unit_number || "—"}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Live Status</span>
              <StatusBadge status={activeRequest.status} />
            </div>
          </div>

          {activeRequest.status === "approved" && (
            <div
              style={{
                padding: "1rem",
                borderRadius: "8px",
                background: visitorPhotoUrl ? "#F0FDF4" : "#FEF2F2",
                border: visitorPhotoUrl ? "1px solid #86EFAC" : "2px solid #F87171",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E293B" }}>
                  📷 Visitor Entry Photograph <span style={{ color: "#DC2626", fontWeight: 900 }}>* (Mandatory)</span>
                </label>
                {visitorPhotoUrl ? (
                  <span style={{ fontSize: "0.75rem", color: "#16A34A", fontWeight: 700 }}>
                    ✓ Photograph Ready for Admittance
                  </span>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "#DC2626", fontWeight: 700 }}>
                    ⚠️ Photograph Required to Admit Visitor
                  </span>
                )}
              </div>
              <FileUpload
                kind="visitor_photo"
                label="Attach visitor face photograph before allowing entry"
                currentUrl={visitorPhotoUrl || undefined}
                onUploadComplete={(url) => {
                  setVisitorPhotoUrl(url);
                  setErrorMessage(null);
                }}
              />
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isAdmitting}
            >
              {activeRequest.status === "rejected" ? "Dismiss" : "Cancel"}
            </button>

            {activeRequest.status === "approved" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAdmitVisitor}
                disabled={isAdmitting}
                style={{ fontWeight: 800, padding: "0.6rem 1.5rem", background: "#059669", borderColor: "#059669" }}
              >
                {isAdmitting ? "Recording…" : "🚪 ALLOW GATE ENTRY & RECORD TIMESTAMP"}
              </button>
            )}
          </div>
        </div>
      )}

      {step === "admitted" && (
        <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>✅</div>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#065F46" }}>
            Gate Entry Recorded!
          </h3>
          <p style={{ color: "var(--muted)", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
            {visitorName} has been admitted. Entry timestamp and guard ID recorded in the permanent audit trail.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
            style={{ padding: "0.6rem 2rem", fontWeight: 700 }}
          >
            ✓ Done / Next Visitor
          </button>
        </div>
      )}
    </Modal>

      {/* Prominent Red Alert Blacklist Pop-Up Modal */}
      {blacklistHit && (
        <Modal
          isOpen={true}
          onClose={() => setBlacklistHit(null)}
          title="⛔ ENTRY DENIED — VISITOR IS BLOCKED"
          size="md"
        >
          <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "0.5rem" }}>🚫</div>
            <h3
              style={{
                color: "#991B1B",
                margin: "0 0 0.5rem 0",
                fontSize: "1.3rem",
                fontWeight: 800,
              }}
            >
              SECURITY BLACKLIST ALERT
            </h3>
            <p
              style={{
                color: "#DC2626",
                fontSize: "0.95rem",
                fontWeight: 700,
                marginBottom: "1.25rem",
              }}
            >
              DO NOT PERMIT ENTRY TO COMMUNITY PREMISES
            </p>

            <div
              style={{
                background: "#FEF2F2",
                border: "2px solid #F87171",
                borderRadius: "8px",
                padding: "1rem 1.25rem",
                textAlign: "left",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ marginBottom: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#991B1B",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Visitor Name
                </span>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "#111827" }}>
                  {visitorName || "Walk-In Visitor"}
                </div>
              </div>
              {visitorPhone && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#991B1B",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Phone Number
                  </span>
                  <div style={{ fontFamily: "monospace", fontWeight: 600 }}>
                    {visitorPhone}
                  </div>
                </div>
              )}
              {idNumber && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#991B1B",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Government ID
                  </span>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 700,
                      color: "#991B1B",
                    }}
                  >
                    {idType.toUpperCase()}: {idNumber.toUpperCase()}
                  </div>
                </div>
              )}
              <div
                style={{
                  marginTop: "0.5rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px dashed #FCA5A5",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#991B1B",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Reason for Restriction
                </span>
                <div
                  style={{
                    fontWeight: 600,
                    color: "#7F1D1D",
                    marginTop: "0.15rem",
                  }}
                >
                  {blacklistHit.reason}
                </div>
              </div>
              {blacklistHit.risk_level && (
                <div style={{ marginTop: "0.5rem" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#991B1B",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Threat Level:{" "}
                  </span>
                  <span
                    style={{
                      fontWeight: 800,
                      color: "#B91C1C",
                      textTransform: "uppercase",
                    }}
                  >
                    {blacklistHit.risk_level}
                  </span>
                </div>
              )}
            </div>

            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--muted)",
                marginBottom: "1.5rem",
              }}
            >
              This visitor is explicitly barred from entry under community security policy. Immediately notify the Security Supervisor.
            </p>

            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setBlacklistHit(null)}
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "1rem",
                fontWeight: 800,
              }}
            >
              ⛔ ACKNOWLEDGE RESTRICTION & DENY ENTRY
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
