"use client";

import { useState } from "react";

type PricingButtonProps = {
  priceId: string;
  label: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function PricingButton({ priceId, label, className, style }: PricingButtonProps) {
  const [loading, setLoading] = useState(false);
  const disabled = loading || !priceId;

  const onClick = async () => {
    if (disabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      if (res.status === 401) {
        window.location.href = "/api/auth/login";
        return;
      }
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={onClick} className={className} style={style} disabled={disabled}>
      {loading ? "Redirecting..." : label}
    </button>
  );
}
