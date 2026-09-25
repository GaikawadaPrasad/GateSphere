"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/common/Modal";
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
    .string()
    .transform(normalizePlate)
    .refine((v) => PLATE_PATTERN.test(v), "Enter a valid plate (3–15 letters/digits)"),
  violation_type: z.enum(Object.keys(VIOLATION_TYPE_LABELS) as [ViolationType, ...ViolationType[]]),
  parking_slot_id: z.string().optional(),
  description: z.string().trim().max(2000).optional(),
  fine_amount: z
    .string()
    .optional()
    .refine((v) => !v || (Number(v) >= 0 && Number.isFinite(Number(v))), "Enter a valid amount"),
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
      <span role="alert" style={{ color: "var(--danger, #e03b3b)", fontSize: "0.75rem" }}>
        {msg}
      </span>
    ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🅿️ Report Parking Violation"
      footer={
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={report.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="report-violation-form"
            className="btn btn-primary"
            disabled={report.isPending}
            aria-busy={report.isPending}
          >
            {report.isPending ? "Reporting…" : "Report Violation"}
          </button>
        </div>
      }
    >
      <form
        id="report-violation-form"
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
        noValidate
      >
        {errors.root && (
          <div
            role="alert"
            style={{
              padding: "0.6rem 0.8rem",
              borderRadius: "var(--radius)",
              background: "var(--danger-light)",
              border: "1px solid var(--danger-border)",
              color: "#991b1b",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {errors.root.message}
          </div>
        )}
        <div>
          <label className="form-label" htmlFor="rv-plate">
            Vehicle plate *
          </label>
          <input
            id="rv-plate"
            className="form-control"
            placeholder="e.g. KA01AB1234"
            autoComplete="off"
            style={{ textTransform: "uppercase", fontFamily: "monospace" }}
            {...register("registration_number")}
          />
          {fieldError(errors.registration_number?.message)}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
            gap: "0.9rem",
          }}
        >
          <div>
            <label className="form-label" htmlFor="rv-type">
              Violation type *
            </label>
            <select id="rv-type" className="form-control" {...register("violation_type")}>
              {Object.entries(VIOLATION_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="rv-slot">
              Parking slot
            </label>
            <select id="rv-slot" className="form-control" {...register("parking_slot_id")}>
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
          <label className="form-label" htmlFor="rv-desc">
            Details
          </label>
          <textarea
            id="rv-desc"
            className="form-control"
            rows={3}
            placeholder="Where is it parked, what is it blocking…"
            {...register("description")}
          />
          {fieldError(errors.description?.message)}
        </div>
        {allowFine && (
          <div>
            <label className="form-label" htmlFor="rv-fine">
              Fine (₹, optional)
            </label>
            <input
              id="rv-fine"
              className="form-control"
              inputMode="decimal"
              placeholder="Leave empty for a warning"
              {...register("fine_amount")}
            />
            {fieldError(errors.fine_amount?.message)}
          </div>
        )}
      </form>
    </Modal>
  );
}
