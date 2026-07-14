import { redirect } from "next/navigation";

/**
 * The old static admin mock lived here; the real role-guarded dashboard is
 * /admin. Kept as a redirect so bookmarks and old links keep working.
 */
export default function DashboardOverviewRedirect() {
  redirect("/admin");
}
