"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type UpgradedBannerProps = {
  planName?: string;
};

export default function UpgradedBanner({ planName = "Starter" }: UpgradedBannerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const flags = useMemo(() => {
    const upgraded = searchParams.get("upgraded") === "1";
    const canceled = searchParams.get("upgrade_canceled") === "1";
    return { upgraded, canceled };
  }, [searchParams]);

  useEffect(() => {
    if (flags.upgraded) setVisible(true);
  }, [flags.upgraded]);

  useEffect(() => {
    if (!flags.upgraded && !flags.canceled) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("upgraded");
    params.delete("upgrade_canceled");
    const next = params.toString();
    const nextUrl = next ? `${pathname}?${next}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [flags.canceled, flags.upgraded, pathname, router, searchParams]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 8000);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "#4f46e5",
        color: "white",
        padding: "10px 16px",
        borderRadius: 999,
        boxShadow: "0 10px 24px rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span>Upgrade successful — {planName} unlocked.</span>
      <button
        onClick={() => setVisible(false)}
        style={{
          border: "none",
          background: "rgba(255,255,255,.18)",
          color: "white",
          padding: "4px 8px",
          borderRadius: 999,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
        }}
        aria-label="Dismiss upgrade notice"
      >
        Dismiss
      </button>
    </div>
  );
}
