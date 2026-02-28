import { auth0 } from "@/lib/auth0";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/api/auth/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
  ],
};
