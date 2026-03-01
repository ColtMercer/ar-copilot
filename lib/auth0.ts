import { Auth0Client } from "@auth0/nextjs-auth0/server";

const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL;
function extractDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).host;
  } catch {
    return url;
  }
}
const domain = process.env.AUTH0_DOMAIN || extractDomain(issuerBaseUrl);
const appBaseUrl =
  process.env.APP_BASE_URL ||
  process.env.AUTH0_BASE_URL ||
  "https://arcopilot.ai";

export const auth0 = new Auth0Client({
  domain,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  appBaseUrl,
  authorizationParameters: {
    scope: "openid profile email",
  },
  // Railway reverse proxy terminates SSL and forwards HTTP internally.
  // Without secure:false, the transaction cookie never gets set/read
  // during the OAuth callback flow, causing login to silently fail.
  transactionCookie: {
    sameSite: "lax" as const,
    secure: false,
  },
  routes: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    callback: "/api/auth/callback",
  },
});
