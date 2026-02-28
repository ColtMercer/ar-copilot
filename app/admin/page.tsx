import AdminClient from "./AdminClient";
import { requireSession } from "@/lib/auth";

export default async function AdminPage() {
  await requireSession();
  return <AdminClient />;
}
