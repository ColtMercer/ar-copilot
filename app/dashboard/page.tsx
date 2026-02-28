import DashboardClient from "./DashboardClient";
import { requireSession } from "@/lib/auth";

export default async function DashboardPage() {
  await requireSession();
  return <DashboardClient />;
}
