"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/common/Modal";
import { BrandButton } from "@/components/common/BrandButton";
import { useReportViolation } from "@/hooks/use-vehicles";
import { toast } from "@/store/toast";
import {
  PLATE_PATTERN,
  VIOLATION_TYPE_LABELS,
  normalizePlate,
  type ParkingSlot,
  type ViolationType,
} from "@/types/vehicles";

const schema = z.object({
  registration_number: z
    .string({ required_error: "License plate / registration number is required" })
    .trim()
    .min(1, "License plate / registration number is required")
    .transform(normalizePlate)
    .refine((v) => v.length >= 3, "Registration number must be at least 3 characters")
    .refine((v) => v.length <= 15, "Registration number cannot exceed 15 characters")
    .refine(
      (v) => PLATE_PATTERN.test(v),
      "License plate must contain only letters and numbers (e.g. KA01AB1234)",
    ),
  violation_type: z.enum(Object.keys(VIOLATION_TYPE_LABELS) as [ViolationType, ...ViolationType[]], {
    errorMap: () => ({ message: "Please select a violation type" }),
  }),
  parking_slot_id: z.string().optional(),
  description: z
    .string()
    .trim()
    .max(2000, "Details cannot exceed 2000 characters")
    .optional(),
  fine_amount: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100000),
      "Enter a valid amount between ₹0 and ₹1,00,000",
    ),
});
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  communityId: string | null;
  slots: ParkingSlot[];
  /** Fines are a staff decision — residents report without one (backend `STAFF_ONLY`). */
  allowFine: boolean;
  defaultPlate?: string;
  /** Extra refresh for screens whose data isn't under the `["vehicles", cid]` keys. */
  onReported?: () => void;
}

/** Report an unauthorized / misparked vehicle. The plate is auto-matched server-side. */
export function ReportViolationModal({
  isOpen,
  onClose,
  communityId,
  slots,
  allowFine,
  defaultPlate,
  onReported,
}: Props) {
  const report = useReportViolation(communityId);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: { registration_number: "", violation_type: "unauthorized" },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        registration_number: defaultPlate ?? "",
        violation_type: "unauthorized",
        parking_slot_id: "",
        description: "",
        fine_amount: "",
      });
    }
  }, [isOpen, defaultPlate, reset]);

  const onSubmit = (v: FormOut) => {
    report.submit(
      {
        registration_number: v.registration_number,
        violation_type: v.violation_type,
        parking_slot_id: v.parking_slot_id || undefined,
        description: v.description || undefined,
        fine_amount: allowFine && v.fine_amount ? Number(v.fine_amount) : undefined,
      },
      {
        onSuccess: (row) => {
          toast.success(
            row.vehicle_id
              ? `Violation reported for ${row.registration_number}; the owner has been notified.`
              : `Violation reported for unregistered vehicle ${row.registration_number}.`,
            "Violation reported",
          );
          onReported?.();
          onClose();
        },
        onError: (err: any) => {
          const fields = err?.fields as Record<string, string> | undefined;
          if (fields) {
            for (const [k, msg] of Object.entries(fields)) {
              if (k in schema.shape) setError(k as keyof FormIn, { message: String(msg) });
            }
          }
          setError("root", { message: err?.message || "Could not report the violation." });
        },
      },
    );
  };

  const fieldError = (msg?: string) =>
    msg ? (
      <span
        role="alert"
        style={{
          color: "#ef4444",
          fontSize: "12px",
          fontWeight: 600,
          marginTop: "0.3rem",
          display: "block",
        }}
      >
        {msg}
      </span>
    ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🅿️ Report Parking Violation"
      footer={
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", width: "100%" }}>
          <BrandButton
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={report.isPending}
          >
            Cancel
          </BrandButton>
          <BrandButton
            type="submit"
            form="report-violation-form"
            variant="primary"
            isLoading={report.isPending}
          >
            Report Violation
          </BrandButton>
        </div>
      }
    >
      <form
        id="report-violation-form"
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        noValidate
      >
        {errors.root && (
          <div
            role="alert"
            style={{
              padding: "0.6rem 0.85rem",
              borderRadius: "var(--radius-sm, 8px)",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {errors.root.message}
          </div>
        )}

        <div>
          <label
            htmlFor="rv-plate"
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--brand-heading, #0f172a)",
              marginBottom: "0.35rem",
            }}
          >
            Vehicle Plate <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            id="rv-plate"
            className="input-field"
            placeholder="e.g. KA01AB1234"
            autoComplete="off"
            style={{
              textTransform: "uppercase",
              fontFamily: "monospace",
              fontWeight: 600,
              borderColor: errors.registration_number ? "#ef4444" : undefined,
            }}
            {...register("registration_number")}
          />
          {fieldError(errors.registration_number?.message)}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
            gap: "0.85rem",
          }}
        >
          <div>
            <label
              htmlFor="rv-type"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--brand-heading, #0f172a)",
                marginBottom: "0.35rem",
              }}
            >
              Violation Type <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              id="rv-type"
              className="select-field"
              style={{ borderColor: errors.violation_type ? "#ef4444" : undefined }}
              {...register("violation_type")}
            >
              {Object.entries(VIOLATION_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            {fieldError(errors.violation_type?.message)}
          </div>

          <div>
            <label
              htmlFor="rv-slot"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--brand-heading, #0f172a)",
                marginBottom: "0.35rem",
              }}
            >
              Parking Slot
            </label>
            <select
              id="rv-slot"
              className="select-field"
              style={{ borderColor: errors.parking_slot_id ? "#ef4444" : undefined }}
              {...register("parking_slot_id")}
            >
              <option value="">— Not at a numbered slot —</option>
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.slot_code} {s.level ? `· ${s.level}` : ""} {s.is_guest_slot ? "(guest)" : ""}
                </option>
              ))}
            </select>
            {fieldError(errors.parking_slot_id?.message)}
          </div>
        </div>

        <div>
          <label
            htmlFor="rv-desc"
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--brand-heading, #0f172a)",
              marginBottom: "0.35rem",
            }}
          >
            Details
          </label>
          <textarea
            id="rv-desc"
            className="textarea-field"
            rows={3}
            placeholder="Where is it parked, what is it blocking…"
            style={{ borderColor: errors.description ? "#ef4444" : undefined }}
            {...register("description")}
          />
          {fieldError(errors.description?.message)}
        </div>

        {allowFine && (
          <div>
            <label
              htmlFor="rv-fine"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--brand-heading, #0f172a)",
                marginBottom: "0.35rem",
              }}
            >
              Fine Amount (₹, optional)
            </label>
            <input
              id="rv-fine"
              className="input-field"
              inputMode="decimal"
              placeholder="Leave empty for a warning"
              style={{ borderColor: errors.fine_amount ? "#ef4444" : undefined }}
              {...register("fine_amount")}
            />
            {fieldError(errors.fine_amount?.message)}
          </div>
        )}
      </form>
    </Modal>
  );
}
