import { redirect } from "next/navigation";

export default function SecurityGuardDashboardRedirect() {
  redirect("/security-guard/dashboard");
}
