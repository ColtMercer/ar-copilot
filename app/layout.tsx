import type { Metadata } from "next";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import "./globals.css";

export const metadata: Metadata = {
  title: "AR Copilot — Get paid faster without being awkward",
  description:
    "AR Copilot helps freelancers and small agencies follow up on overdue invoices with the right message at the right time—without sounding desperate.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        <Auth0Provider>{children}</Auth0Provider>
      </body>
    </html>
  );
}
