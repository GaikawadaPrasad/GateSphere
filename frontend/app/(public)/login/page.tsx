"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import GateSphereLogo from "@/components/public/GateSphereLogo";
import { ApiError } from "@/lib/api";
import { useLogin } from "@/hooks/use-auth";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "super_admin@gatesphere.com", pass: "Admin@123", icon: "👑" },
  { role: "Community Admin", email: "community_admin@gatesphere.com", pass: "Admin@123", icon: "🏢" },
  { role: "Security Guard", email: "guard@gatesphere.com", pass: "Guard@123", icon: "🛡️" },
  { role: "Resident", email: "resident@gatesphere.com", pass: "Resident@123", icon: "🏡" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "super_admin@gatesphere.com", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await login.mutateAsync(values);
      const next = params.get("next");
      if (next) {
        router.replace(next);
        return;
      }

      // active_role is always returned by /auth/login — use it as the source of truth
      if (user?.is_superadmin || user?.active_role === "super_admin") {
        router.replace("/super-admin/dashboard");
      } else if (user?.active_role === "community_admin") {
        router.replace("/community-admin/dashboard");
      } else if (
        user?.active_role === "security_guard" ||
        user?.active_role === "security_supervisor"
      ) {
        router.replace("/gate/live");
      } else if (user?.active_role === "resident") {
        router.replace("/resident/home");
      } else {
        // Fallback: go to /dashboard which will re-detect and redirect
        router.replace("/dashboard");
      }
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          setError(field as keyof FormValues, { message });
        }
      } else {
        setError("root", {
          message: err instanceof ApiError ? err.message : "Sign in failed. Check your credentials.",
        });
      }
    }
  });

  const handleSelectDemoAccount = (email: string, pass: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", pass, { shouldValidate: true });
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-[#070C18] text-white relative overflow-hidden px-4 py-12 selection:bg-blue-600 selection:text-white">
      {/* Background Aurora Ambient Lights */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[380px] rounded-full blur-[140px] pointer-events-none opacity-40"
        style={{
          background: "radial-gradient(circle, rgba(37, 99, 235, 0.4) 0%, rgba(7, 12, 24, 0) 70%)",
        }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full blur-[120px] pointer-events-none opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(13, 148, 136, 0.35) 0%, rgba(7, 12, 24, 0) 70%)",
        }}
      />

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Top Branding */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block transition-transform hover:scale-105 mb-4">
            <GateSphereLogo className="justify-center" variant="light" size="large" />
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400 font-mono mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Enterprise Security Access</span>
          </div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight"
            style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
          >
            Sign in to GateSphere
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Access your township management &amp; gate terminal
          </p>
        </div>

        {/* Main Glassmorphic Login Card */}
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl p-7 sm:p-8">
          <form onSubmit={onSubmit} noValidate className="space-y-4.5">
            {/* Root Error Alert */}
            {errors.root && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 font-medium animate-shake">
                <svg className="w-4 h-4 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errors.root.message}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                Work Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@community.com"
                  {...register("email")}
                  className={`w-full px-4 py-3 rounded-xl bg-slate-800/80 border text-white text-sm placeholder-slate-500 transition-all outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    errors.email ? "border-red-500/80" : "border-slate-700 hover:border-slate-600"
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400 mt-1 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-slate-300 font-mono">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  {...register("password")}
                  className={`w-full px-4 py-3 pr-11 rounded-xl bg-slate-800/80 border text-white text-sm placeholder-slate-500 transition-all outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    errors.password ? "border-red-500/80" : "border-slate-700 hover:border-slate-600"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400 mt-1 font-medium">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-blue-600/30 cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
              }}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Verifying credentials…</span>
                </>
              ) : (
                <>
                  <span>Sign in to Dashboard</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Helper */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 font-mono text-center">
              Quick Demo Accounts
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleSelectDemoAccount(acc.email, acc.pass)}
                  className="px-2.5 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 text-left transition-all text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="text-sm">{acc.icon}</span>
                  <span className="font-medium truncate">{acc.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Back Link to Public Site */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <span>← Back to GateSphere Homepage</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-[#070C18] text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
