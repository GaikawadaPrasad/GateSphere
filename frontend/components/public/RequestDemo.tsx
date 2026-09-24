"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { useReveal } from "@/hooks/use-reveal";
import { saveDemoRequest } from "@/lib/demo-requests";

interface FormFields {
  fullName: string;
  email: string;
  countryCode: string;
  phone: string;
  community: string;
  units: string;
  role: string;
  product: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  community?: string;
}

interface FormTouched {
  fullName?: boolean;
  email?: boolean;
  phone?: boolean;
  community?: boolean;
}

const COUNTRY_CONFIGS: Record<
  string,
  { flag: string; name: string; placeholder: string; regex: RegExp; errorMsg: string }
> = {
  "+91": {
    flag: "🇮🇳",
    name: "India",
    placeholder: "98765 43210",
    regex: /^[6-9]\d{9}$/,
    errorMsg: "Enter a valid 10-digit Indian mobile number starting with 6-9.",
  },
  "+1": {
    flag: "🇺🇸",
    name: "USA / Canada",
    placeholder: "202 555 0123",
    regex: /^[2-9]\d{9}$/,
    errorMsg: "Enter a valid 10-digit North American phone number.",
  },
  "+44": {
    flag: "🇬🇧",
    name: "UK",
    placeholder: "7911 123456",
    regex: /^(7\d{9}|[1-9]\d{9,10})$/,
    errorMsg: "Enter a valid UK mobile or landline number (10-11 digits).",
  },
  "+971": {
    flag: "🇦🇪",
    name: "UAE",
    placeholder: "50 123 4567",
    regex: /^(5\d{8}|[2-9]\d{7,8})$/,
    errorMsg: "Enter a valid UAE mobile number (e.g. 50 123 4567).",
  },
  "+65": {
    flag: "🇸🇬",
    name: "Singapore",
    placeholder: "8123 4567",
    regex: /^[89]\d{7}$/,
    errorMsg: "Enter a valid 8-digit Singapore mobile number starting with 8 or 9.",
  },
};

const NAME_REGEX = /^[A-Za-z\s.'-]{2,60}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function RequestDemo() {
  const { ref, visible } = useReveal();
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const communityInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormFields>({
    fullName: "",
    email: "",
    countryCode: "+91",
    phone: "",
    community: "",
    units: "100 – 500",
    role: "Administrator",
    product: "Full Platform",
  });

  const [touched, setTouched] = useState<FormTouched>({});
  const [errors, setErrors] = useState<FormErrors>({});

  const validateField = (field: keyof FormFields, value: string, currentCountryCode = formData.countryCode): string | undefined => {
    switch (field) {
      case "fullName": {
        const trimmed = value.trim();
        if (!trimmed) return "Full Name is required.";
        if (trimmed.length < 2) return "Full Name must be at least 2 characters.";
        if (!NAME_REGEX.test(trimmed)) return "Name can only contain letters, spaces, hyphens, or periods.";
        return undefined;
      }
      case "email": {
        const trimmed = value.trim();
        if (!trimmed) return "Work / Official Email is required.";
        if (!EMAIL_REGEX.test(trimmed)) return "Enter a valid email address (e.g. name@community.com).";
        return undefined;
      }
      case "phone": {
        const normalized = value.replace(/[\s-()]/g, "");
        if (!normalized) return "Phone number is required.";
        const config = COUNTRY_CONFIGS[currentCountryCode];
        if (config) {
          if (!config.regex.test(normalized)) {
            return config.errorMsg;
          }
        } else {
          if (!/^\d{7,15}$/.test(normalized)) {
            return "Enter a valid phone number (7 to 15 digits).";
          }
        }
        return undefined;
      }
      case "community": {
        const trimmed = value.trim();
        if (!trimmed) return "Community / Society Name is required.";
        if (trimmed.length < 3) return "Community name must be at least 3 characters.";
        return undefined;
      }
      default:
        return undefined;
    }
  };

  const validateAll = (data: FormFields = formData): FormErrors => {
    const newErrors: FormErrors = {};
    const nameErr = validateField("fullName", data.fullName);
    if (nameErr) newErrors.fullName = nameErr;

    const emailErr = validateField("email", data.email);
    if (emailErr) newErrors.email = emailErr;

    const phoneErr = validateField("phone", data.phone, data.countryCode);
    if (phoneErr) newErrors.phone = phoneErr;

    const commErr = validateField("community", data.community);
    if (commErr) newErrors.community = commErr;

    return newErrors;
  };

  const handleBlur = (field: keyof FormTouched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errorMsg = validateField(field as keyof FormFields, formData[field as keyof FormFields]);
    setErrors((prev) => ({ ...prev, [field]: errorMsg }));
  };

  const handleChange = (field: keyof FormFields, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);

    // If field has already been touched or form submit was attempted, re-validate dynamically
    if (touched[field as keyof FormTouched] || submitAttempted) {
      const errorMsg = validateField(field, value, field === "countryCode" ? value : updated.countryCode);
      setErrors((prev) => ({ ...prev, [field]: errorMsg }));
    }

    // Special case: if changing countryCode, re-evaluate phone error
    if (field === "countryCode" && (touched.phone || submitAttempted)) {
      const phoneErr = validateField("phone", updated.phone, value);
      setErrors((prev) => ({ ...prev, phone: phoneErr }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    // Mark all as touched
    setTouched({
      fullName: true,
      email: true,
      phone: true,
      community: true,
    });

    const validationErrors = validateAll();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      // Focus the first invalid field
      if (validationErrors.fullName) {
        nameInputRef.current?.focus();
      } else if (validationErrors.email) {
        emailInputRef.current?.focus();
      } else if (validationErrors.phone) {
        phoneInputRef.current?.focus();
      } else if (validationErrors.community) {
        communityInputRef.current?.focus();
      }
      return;
    }

    setServerError(null);
    setSubmitting(true);

    try {
      const generatedTicket = `#GS-DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
      setTicketId(generatedTicket);
      saveDemoRequest({
        ticketId: generatedTicket,
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: `${formData.countryCode} ${formData.phone.replace(/[\s-()]/g, "")}`,
        community: formData.community.trim(),
        units: formData.units,
        role: formData.role,
        product: formData.product,
      });
      setSubmitted(true);
    } catch (err: any) {
      setServerError(err?.message || "Something went wrong while submitting. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      fullName: "",
      email: "",
      countryCode: "+91",
      phone: "",
      community: "",
      units: "100 – 500",
      role: "Administrator",
      product: "Full Platform",
    });
    setErrors({});
    setTouched({});
    setSubmitAttempted(false);
    setServerError(null);
    setSubmitted(false);
  };

  const isFieldValid = (field: keyof FormTouched, value: string) => {
    return (touched[field] || submitAttempted) && !errors[field] && value.trim().length > 0;
  };

  return (
    <section
      id="demo"
      ref={ref}
      className="relative py-12 sm:py-16 bg-white overflow-hidden border-b border-slate-200/80"
      style={{
        backgroundImage:
          "radial-gradient(circle at 10% 20%, rgba(224, 242, 254, 0.45) 0%, transparent 45%), radial-gradient(circle at 90% 80%, rgba(240, 253, 244, 0.45) 0%, transparent 45%)",
      }}
    >
      {/* Background Geometric Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#F1F5F9_1px,transparent_1px),linear-gradient(to_bottom,#F1F5F9_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-60 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* ── LEFT COLUMN: Value Proposition & Visual ── */}
          <div className={`lg:col-span-6 reveal-left ${visible ? "visible" : ""}`}>
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-3.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span
                className="text-[11px] font-bold tracking-wider text-blue-900 uppercase"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Contact us
              </span>
            </div>

            {/* Headline */}
            <h2
              className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-950 tracking-tight leading-[1.14] mb-3"
              style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
            >
              Ready to make community management{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-600 to-teal-600">
                simpler and more secure?
              </span>
            </h2>

            <p
              className="text-[15px] sm:text-[16px] text-slate-600 font-normal leading-relaxed max-w-xl mb-6"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              See how GateSphere connects security, residents, and administrative operations in a live 1-on-1 walkthrough tailored specifically for your township or apartment society.
            </p>

            {/* Embedded Visual */}
            <div className="relative rounded-3xl overflow-hidden border border-slate-200/90 shadow-2xl mb-6 group h-[280px] sm:h-[310px] w-full">
              <Image
                src="/images/demo-township-towers.webp"
                alt="Luxury residential high-rise towers and grand gated security entrance"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent pointer-events-none" />

              <div className="absolute bottom-4 left-4 right-4 bg-slate-950/85 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-white flex items-center justify-between shadow-xl">
                <div>
                  <div className="text-[9px] font-extrabold tracking-wider uppercase text-cyan-400">
                    GATESPHERE ENTERPRISE
                  </div>
                  <div className="text-[12.5px] font-bold text-white tracking-tight">
                    Multi-Gate &amp; High-Rise Township Ready
                  </div>
                </div>
              </div>
            </div>

            {/* Social Proof Strip */}
            <div className="flex items-center gap-4 pt-3 border-t border-slate-200">
              <div className="flex -space-x-2">
                <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-xs">
                  <Image src="/images/rajan-pillai.webp" alt="RWA President" fill sizes="36px" className="object-cover" />
                </div>
                <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-xs">
                  <Image src="/images/priya-nambiar.webp" alt="Council Member" fill sizes="36px" className="object-cover" />
                </div>
                <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-xs">
                  <Image src="/images/sunil-krishnamurthy.webp" alt="Security Head" fill sizes="36px" className="object-cover" />
                </div>
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">Trusted by 450+ Communities</div>
                <div className="text-slate-500 text-[11px]">Join over 14,000+ satisfied households</div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Form Card ── */}
          <div className={`lg:col-span-6 reveal-right ${visible ? "visible" : ""}`}>
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-2xl shadow-slate-200/50 relative">
              {submitted ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto text-2xl shadow-sm">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3
                    className="text-2xl font-extrabold text-slate-900 tracking-tight"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    Request Confirmed!
                  </h3>
                  <p className="text-[14px] text-slate-600 max-w-md mx-auto leading-relaxed">
                    Thank you, <span className="font-semibold text-slate-900">{formData.fullName}</span>! An executive community specialist will contact you shortly to schedule your personalized live walkthrough.
                  </p>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 inline-block font-mono shadow-xs">
                    Request ID: <span className="font-bold text-blue-700">{ticketId}</span>
                  </div>

                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200 cursor-pointer"
                    >
                      ← Submit Another Request
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
                  <div className="border-b border-slate-100 pb-3 mb-1">
                    <h3
                      className="text-[20px] font-extrabold text-slate-950 tracking-tight"
                      style={{ fontFamily: "'Outfit', sans-serif" }}
                    >
                      Contact us
                    </h3>
                    <p className="text-[12.5px] text-slate-500 font-normal">
                      Fill in your details for a tailored 1-on-1 walkthrough.
                    </p>
                  </div>

                  {submitAttempted && Object.keys(errors).length > 0 && (
                    <div className="p-3 bg-red-50/80 border border-red-200/90 rounded-xl text-red-700 text-[12px] font-medium flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>Please correct the highlighted errors below before submitting.</span>
                    </div>
                  )}

                  {/* Row 1: Full Name & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="contact-full-name" className="block text-[11.5px] font-bold text-slate-800">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          id="contact-full-name"
                          ref={nameInputRef}
                          type="text"
                          placeholder="e.g. Rajan Pillai"
                          value={formData.fullName}
                          onBlur={() => handleBlur("fullName")}
                          onChange={(e) => handleChange("fullName", e.target.value)}
                          aria-invalid={!!errors.fullName}
                          aria-describedby={errors.fullName ? "fullname-error" : undefined}
                          className={`w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 transition-all outline-none ${
                            errors.fullName
                              ? "bg-red-50/30 border-red-400 focus:border-red-500 focus:ring-3 focus:ring-red-500/15 border"
                              : isFieldValid("fullName", formData.fullName)
                              ? "bg-emerald-50/20 border-emerald-400/80 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 border"
                              : "bg-[#F8FAFC] border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 border"
                          }`}
                        />
                        {isFieldValid("fullName", formData.fullName) && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </div>
                      {errors.fullName && (
                        <p id="fullname-error" className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {errors.fullName}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="contact-email" className="block text-[11.5px] font-bold text-slate-800">
                          Work / Official Email <span className="text-red-500">*</span>
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          id="contact-email"
                          ref={emailInputRef}
                          type="email"
                          placeholder="name@community.com"
                          value={formData.email}
                          onBlur={() => handleBlur("email")}
                          onChange={(e) => handleChange("email", e.target.value)}
                          aria-invalid={!!errors.email}
                          aria-describedby={errors.email ? "email-error" : undefined}
                          className={`w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 transition-all outline-none ${
                            errors.email
                              ? "bg-red-50/30 border-red-400 focus:border-red-500 focus:ring-3 focus:ring-red-500/15 border"
                              : isFieldValid("email", formData.email)
                              ? "bg-emerald-50/20 border-emerald-400/80 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 border"
                              : "bg-[#F8FAFC] border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 border"
                          }`}
                        />
                        {isFieldValid("email", formData.email) && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </div>
                      {errors.email && (
                        <p id="email-error" className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Phone Number & Community Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="contact-phone" className="block text-[11.5px] font-bold text-slate-800">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={formData.countryCode}
                          aria-label="Country calling code"
                          onChange={(e) => handleChange("countryCode", e.target.value)}
                          className="w-[90px] shrink-0 px-2 py-2.5 rounded-xl text-[13px] font-medium text-slate-900 bg-[#F8FAFC] border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                        >
                          {Object.entries(COUNTRY_CONFIGS).map(([code, cfg]) => (
                            <option key={code} value={code}>
                              {cfg.flag} {code}
                            </option>
                          ))}
                        </select>
                        <div className="relative w-full">
                          <input
                            id="contact-phone"
                            ref={phoneInputRef}
                            type="tel"
                            inputMode="tel"
                            placeholder={COUNTRY_CONFIGS[formData.countryCode]?.placeholder || "Mobile number"}
                            value={formData.phone}
                            onBlur={() => handleBlur("phone")}
                            onChange={(e) => handleChange("phone", e.target.value)}
                            aria-invalid={!!errors.phone}
                            aria-describedby={errors.phone ? "phone-error" : undefined}
                            className={`w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 transition-all outline-none ${
                              errors.phone
                                ? "bg-red-50/30 border-red-400 focus:border-red-500 focus:ring-3 focus:ring-red-500/15 border"
                                : isFieldValid("phone", formData.phone)
                                ? "bg-emerald-50/20 border-emerald-400/80 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 border"
                                : "bg-[#F8FAFC] border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 border"
                            }`}
                          />
                          {isFieldValid("phone", formData.phone) && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>
                      {errors.phone && (
                        <p id="phone-error" className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {errors.phone}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="contact-community" className="block text-[11.5px] font-bold text-slate-800">
                          Community / Society Name <span className="text-red-500">*</span>
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          id="contact-community"
                          ref={communityInputRef}
                          type="text"
                          placeholder="e.g. Serene Palms, Bengaluru"
                          value={formData.community}
                          onBlur={() => handleBlur("community")}
                          onChange={(e) => handleChange("community", e.target.value)}
                          aria-invalid={!!errors.community}
                          aria-describedby={errors.community ? "community-error" : undefined}
                          className={`w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 transition-all outline-none ${
                            errors.community
                              ? "bg-red-50/30 border-red-400 focus:border-red-500 focus:ring-3 focus:ring-red-500/15 border"
                              : isFieldValid("community", formData.community)
                              ? "bg-emerald-50/20 border-emerald-400/80 focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 border"
                              : "bg-[#F8FAFC] border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 border"
                          }`}
                        />
                        {isFieldValid("community", formData.community) && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </div>
                      {errors.community && (
                        <p id="community-error" className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {errors.community}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Number of Units & Role */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="contact-units" className="block text-[11.5px] font-bold text-slate-800 mb-1">
                        Number of Units
                      </label>
                      <select
                        id="contact-units"
                        value={formData.units}
                        onChange={(e) => handleChange("units", e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 bg-[#F8FAFC] border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                      >
                        <option>Under 100 Units</option>
                        <option>100 – 500 Units</option>
                        <option>500 – 1,000 Units</option>
                        <option>1,000+ Units (Township)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="contact-role" className="block text-[11.5px] font-bold text-slate-800 mb-1">
                        Your Role
                      </label>
                      <select
                        id="contact-role"
                        value={formData.role}
                        onChange={(e) => handleChange("role", e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 bg-[#F8FAFC] border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                      >
                        <option>RWA President / Secretary</option>
                        <option>Management Committee Member</option>
                        <option>Estate / Facility Manager</option>
                        <option>Resident / Owner</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Primary Area of Interest */}
                  <div>
                    <label htmlFor="contact-product" className="block text-[11.5px] font-bold text-slate-800 mb-1">
                      Primary Area of Interest
                    </label>
                    <select
                      id="contact-product"
                      value={formData.product}
                      onChange={(e) => handleChange("product", e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 bg-[#F8FAFC] border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                    >
                      <option>Full Platform (Gate, Residents, Dues &amp; Maintenance)</option>
                      <option>Visitor &amp; Vehicle Gate Management Only</option>
                      <option>Resident Experience &amp; Amenity Booking</option>
                      <option>Automated Society Billing &amp; Accounting</option>
                    </select>
                  </div>

                  {serverError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[12.5px] font-medium text-center">
                      {serverError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-[14.5px] font-extrabold text-white bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 shadow-lg shadow-blue-500/20 active:scale-[0.99] hover:from-blue-800 hover:to-indigo-800 cursor-pointer transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Request</span>
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-slate-500 font-medium">
                    🔒 Zero spam guarantee. We only contact you to schedule your demo.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
