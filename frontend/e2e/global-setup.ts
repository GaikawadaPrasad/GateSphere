import fs from "node:fs";
import path from "node:path";
import { request, type FullConfig } from "@playwright/test";
import { ROLES, authFile, demoEmail, demoPassword } from "./support";

/**
 * Sign every journey role in ONCE through the real login endpoint (via the Next.js
 * same-origin proxy, exactly like the browser) and persist its session cookies.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("playwright baseURL is not configured");
  fs.mkdirSync(path.join(__dirname, ".auth"), { recursive: true });

  for (const role of ROLES) {
    const ctx = await request.newContext({ baseURL });
    try {
      const res = await ctx.post("/api/v1/auth/login", {
        data: { email: demoEmail(role), password: demoPassword(role) },
      });
      if (res.status() !== 200) {
        throw new Error(
          `login as ${role} failed (${res.status()}): ${await res.text()} — ` +
            "is the backend running with the seed loaded (`seed --reset`)?",
        );
      }
      await ctx.storageState({ path: authFile(role) });
    } finally {
      await ctx.dispose();
    }
  }
}
