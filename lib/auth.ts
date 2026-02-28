import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";

export async function getSession() {
  return auth0.getSession();
}

export async function requireSession() {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    redirect("/api/auth/login");
  }
  return session;
}
