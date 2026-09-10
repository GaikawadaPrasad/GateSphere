"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useReveal } from "@/hooks/use-reveal";

export default function RequestDemo() {
  const { ref, visible } = useReveal();
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; phone?: string; community?: string }>({});
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    community: "",
    units: "100 – 500",
    role: "Administrator",
    product: "Full Platform",
  });

  const NAME_REGEX = /^[A-Za-z\s]{2,}$/;
  const PHONE_REGEX = /^(\+91[\s-]?)?[6-9]\d{9}$/;

  const isFormValid =
    NAME_REGEX.test(formData.fullName.trim()) &&
    formData.email.trim() !== "" &&
    PHONE_REGEX.test(formData.phone.replace(/\s|-/g, "")) &&
    formData.community.trim() !== "";

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = () => {
    const newErrors: { fullName?: string; email?: string; phone?: string; community?: string } = {};
    if (!NAME_REGEX.test(formData.fullName.trim()))
      newErrors.fullName = "Enter a valid name (letters and spaces only).";
    if (!EMAIL_REGEX.test(formData.email.trim()))
      newErrors.email = "Enter a valid email address.";
    const normalizedPhone = formData.phone.replace(/\s|-/g, "");
    if (!PHONE_REGEX.test(normalizedPhone))
      newErrors.phone = "Enter a valid Indian mobile number starting with 6–9 (e.g. +91 98765 43210).";
    if (!formData.community.trim())
      newErrors.community = "Community / Society Name is required.";
    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    const generatedTicket = `#GS-DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
    setTicketId(generatedTicket);
    setSubmitted(true);
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
                <div className="flex items-center gap-1.5 text-[9.5px] font-mono text-emerald-300 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE DEMO
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
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto text-2xl shadow-sm">
                    ✓
                  </div>
                  <h3
                    className="text-2xl font-extrabold text-slate-900 tracking-tight"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                     Request Confirmed!
                  </h3>
                  <p className="text-[14px] text-slate-600 max-w-md mx-auto leading-relaxed">
                    Thank you! An executive community specialist will contact you shortly to schedule your personalized live walkthrough.
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 inline-block font-mono">
                    Request ID: <span className="font-bold text-blue-700">{ticketId}</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3.5">
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

                  {/* Row 1 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-bold text-slate-800 mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rajan Pillai"
                        required
                        value={formData.fullName}
                        onChange={(e) => {
                          setFormData({ ...formData, fullName: e.target.value });
                          if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 bg-[#F8FAFC] border focus:bg-white focus:ring-3 focus:ring-blue-500/10 outline-none transition-all ${
                          errors.fullName ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-blue-600"
                        }`}
                      />
                      {errors.fullName && (
                        <p className="mt-1 text-[11px] text-red-500 font-medium">{errors.fullName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11.5px] font-bold text-slate-800 mb-1">
                        Work / Official Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="name@community.com"
                        required
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value });
                          if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 bg-[#F8FAFC] border focus:bg-white focus:ring-3 focus:ring-blue-500/10 outline-none transition-all ${
                          errors.email ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-blue-600"
                        }`}
                      />
                      {errors.email && (
                        <p className="mt-1 text-[11px] text-red-500 font-medium">{errors.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-bold text-slate-800 mb-1">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        required
                        value={formData.phone}
                        onChange={(e) => {
                          setFormData({ ...formData, phone: e.target.value });
                          if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 bg-[#F8FAFC] border focus:bg-white focus:ring-3 focus:ring-blue-500/10 outline-none transition-all ${
                          errors.phone ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-blue-600"
                        }`}
                      />
                      {errors.phone && (
                        <p className="mt-1 text-[11px] text-red-500 font-medium">{errors.phone}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11.5px] font-bold text-slate-800 mb-1">
                        Community / Society Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Serene Palms, Bengaluru"
                        required
                        value={formData.community}
                        onChange={(e) => {
                          setFormData({ ...formData, community: e.target.value });
                          if (errors.community) setErrors((prev) => ({ ...prev, community: undefined }));
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 bg-[#F8FAFC] border focus:bg-white focus:ring-3 focus:ring-blue-500/10 outline-none transition-all ${
                          errors.community ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-blue-600"
                        }`}
                      />
                      {errors.community && (
                        <p className="mt-1 text-[11px] text-red-500 font-medium">{errors.community}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-bold text-slate-800 mb-1">
                        Number of Units
                      </label>
                      <select
                        value={formData.units}
                        onChange={(e) => setFormData({ ...formData, units: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 bg-[#F8FAFC] border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 outline-none transition-all"
                      >
                        <option>Under 100 Units</option>
                        <option>100 – 500 Units</option>
                        <option>500 – 1,000 Units</option>
                        <option>1,000+ Units (Township)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11.5px] font-bold text-slate-800 mb-1">
                        Your Role
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 bg-[#F8FAFC] border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 outline-none transition-all"
                      >
                        <option>RWA President / Secretary</option>
                        <option>Management Committee Member</option>
                        <option>Estate / Facility Manager</option>
                        <option>Resident / Owner</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 4 */}
                  <div>
                    <label className="block text-[11.5px] font-bold text-slate-800 mb-1">
                      Primary Area of Interest
                    </label>
                    <select
                      value={formData.product}
                      onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-[13.5px] text-slate-900 bg-[#F8FAFC] border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/10 outline-none transition-all"
                    >
                      <option>Full Platform (Gate, Residents, Dues &amp; Maintenance)</option>
                      <option>Visitor &amp; Vehicle Gate Management Only</option>
                      <option>Resident Experience &amp; Amenity Booking</option>
                      <option>Automated Society Billing &amp; Accounting</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={!isFormValid}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-[14.5px] font-extrabold text-white bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all mt-2 ${
                      isFormValid
                        ? "hover:from-blue-800 hover:to-indigo-800 cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    Submit
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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
