import { Auth0Client } from "@auth0/nextjs-auth0/server";

const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL;
const domain = process.env.AUTH0_DOMAIN || (issuerBaseUrl ? new URL(issuerBaseUrl).host : undefined);
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
  routes: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    callback: "/api/auth/callback",
  },
});
