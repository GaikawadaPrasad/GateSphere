"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { useLogin } from "@/hooks/use-auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
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
      } else if (user?.active_role === "security_guard" || user?.active_role === "security_supervisor") {
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
          message: err instanceof ApiError ? err.message : "Sign in failed",
        });
      }
    }
  });

  return (
    <main className="container">
      <h1>Sign in</h1>
      <form className="card" onSubmit={onSubmit} noValidate>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" {...register("email")} />
        {errors.email && <p className="error">{errors.email.message}</p>}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && <p className="error">{errors.password.message}</p>}

        {errors.root && <p className="error">{errors.root.message}</p>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
