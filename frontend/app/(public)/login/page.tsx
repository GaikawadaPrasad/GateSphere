"use client";

import React, { Suspense } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLogin } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { getRoleLandingRoute } from "@/lib/permissions";

const schema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await login.mutateAsync(values);
      const nextParam = params.get("next");
      const targetUrl = nextParam && nextParam !== "/unauthorized" ? nextParam : getRoleLandingRoute(user);
      router.replace(targetUrl);
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          setError(field as keyof FormValues, { message: Array.isArray(message) ? message[0] : String(message) });
        }
      } else {
        setError("root", {
          message: err instanceof ApiError ? err.message : "Sign in failed",
        });
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      {errors.root && (
        <div role="alert" className="error-banner">
          {errors.root.message}
        </div>
      )}

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? "email-error" : undefined}
        {...register("email")}
      />
      {errors.email && (
        <span id="email-error" className="error-text">
          {errors.email.message}
        </span>
      )}

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        aria-invalid={Boolean(errors.password)}
        aria-describedby={errors.password ? "password-error" : undefined}
        {...register("password")}
      />
      {errors.password && (
        <span id="password-error" className="error-text">
          {errors.password.message}
        </span>
      )}

      <button type="submit" disabled={isSubmitting || login.isPending}>
        {isSubmitting || login.isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="container">
      <h1>Sign in to GateSphere</h1>
      <Suspense fallback={<div className="card">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
