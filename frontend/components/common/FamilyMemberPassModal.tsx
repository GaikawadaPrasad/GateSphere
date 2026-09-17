"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Modal } from "@/components/common/Modal";
import { BrandButton } from "@/components/common/BrandButton";
import { toast } from "@/store/toast";

const QrCodeSvg = dynamic(
  () => import("@/components/common/QrCodeSvg").then((m) => m.QrCodeSvg),
  {
    ssr: false,
    loading: () => (
      <div
        className="skeleton"
        style={{
          width: 180,
          height: 180,
          borderRadius: 12,
        }}
      />
    ),
  },
);

export interface FamilyMemberPassData {
  id: string;
  name: string;
  relation: string;
  phone?: string;
  unit_number?: string;
  access_enabled: boolean;
  pass_token?: string;
  pin?: string;
}

interface FamilyMemberPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMemberPassData | null;
}

export const FamilyMemberPassModal: React.FC<FamilyMemberPassModalProps> = ({
  isOpen,
  onClose,
  member,
}) => {
  if (!member) return null;

  // Stable permanent values derived if not directly passed
  const pin =
    member.pin ||
    `${(Math.abs(member.id.split("").reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)) % 900000) + 100000}`;
  const passToken =
    member.pass_token ||
    `GSE-FAM-${member.id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const qrPayload = `GSE:FAMILY:${member.id}:${pin}`;

  const shareText = `*GateSphere Permanent Family Member Pass*\n👤 Name: ${member.name} (${member.relation})\n🏠 Unit: ${member.unit_number || "Resident Unit"}\n🔑 Permanent Gate PIN: ${pin}\n🎫 Pass Code: ${passToken}\n⚡ Pre-approved permanent household access. Scan or quote PIN at the security gate.`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Permanent Family Gate Pass (QR / OTP)"
      size="md"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center" }}>
        {/* Status Header Banner */}
        <div
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            background: member.access_enabled
              ? "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)"
              : "#FEF2F2",
            border: member.access_enabled ? "1px solid #A7F3D0" : "1px solid #FECACA",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: member.access_enabled ? "#065F46" : "#991B1B",
            }}
          >
            {member.access_enabled
              ? "✓ Active Permanent Household Pass · Whitelisted at Security Gate"
              : "🔒 Gate Access Disabled · Enable in Family Settings to Activate"}
          </div>
          <div
            style={{
              fontSize: "11.5px",
              color: member.access_enabled ? "#047857" : "#7F1D1D",
              marginTop: "0.2rem",
            }}
          >
            {member.access_enabled
              ? "Permanent & Reusable · No visitor pass request or approval required."
              : "Security guards will require manual approval until access is turned back on."}
          </div>
        </div>

        {/* Dynamic Vector SVG QR Code */}
        <div
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "14px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            border: "1px solid var(--border-light)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <QrCodeSvg value={qrPayload} size={190} />
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "0.6rem", fontWeight: 600 }}>
            Scan at Live Security Gate Scanner
          </div>
        </div>

        {/* 6-Digit Permanent PIN / OTP Display */}
        <div
          style={{
            width: "100%",
            background: "#F8FAFC",
            padding: "0.85rem 1rem",
            borderRadius: "8px",
            border: "1px dashed var(--brand-primary)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: "var(--brand-body)",
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: "0.5px",
            }}
          >
            Permanent Gate Entry PIN / OTP Code
          </div>
          <div
            style={{
              fontSize: "26px",
              fontWeight: 800,
              letterSpacing: "5px",
              fontFamily: "monospace",
              color: "var(--brand-primary)",
              margin: "0.35rem 0",
            }}
          >
            {pin}
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>
            Permanent code for {member.name} · Can be used anytime for entry
          </div>
        </div>

        {/* Member Details Metadata Grid */}
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
            background: "#F8FAFC",
            padding: "0.85rem 1rem",
            borderRadius: "8px",
            border: "1px solid var(--border-light)",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Member Name
            </div>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--brand-heading)" }}>
              {member.name}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Relationship
            </div>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--brand-heading)" }}>
              {member.relation}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Assigned Unit
            </div>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--brand-heading)" }}>
              {member.unit_number ? `Unit ${member.unit_number}` : "Resident Household"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
              Pass Type
            </div>
            <div style={{ fontWeight: 700, fontSize: "12.5px", color: "#16A34A" }}>
              Permanent (Unlimited Entries)
            </div>
          </div>
          {member.phone && (
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Mobile Number
              </div>
              <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--brand-heading)", fontFamily: "monospace" }}>
                📞 {member.phone}
              </div>
            </div>
          )}
        </div>

        {/* Quick Action Share Buttons */}
        <div style={{ width: "100%", display: "flex", gap: "0.5rem", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <BrandButton
              type="button"
              variant="outline"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(shareText);
                  toast.success("Permanent pass details copied to clipboard!", "Copied");
                }
              }}
            >
              📋 Copy Pass
            </BrandButton>

            <BrandButton
              type="button"
              variant="outline"
              onClick={() => {
                const encoded = encodeURIComponent(shareText);
                if (typeof window !== "undefined") {
                  window.open(`https://wa.me/?text=${encoded}`, "_blank");
                }
              }}
            >
              💬 WhatsApp
            </BrandButton>

            {typeof navigator !== "undefined" && typeof (navigator as any).share === "function" && (
              <BrandButton
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.share({
                      title: `Gate Pass - ${member.name}`,
                      text: shareText,
                    });
                  } catch {
                    // User dismissed share
                  }
                }}
              >
                📱 Share
              </BrandButton>
            )}
          </div>

          <BrandButton type="button" variant="primary" onClick={onClose}>
            Done
          </BrandButton>
        </div>
      </div>
    </Modal>
  );
};
