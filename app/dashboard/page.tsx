import { Suspense } from "react";
import DashboardClient from "./DashboardClient";
import UpgradedBanner from "@/app/components/UpgradedBanner";
import { requireSession } from "@/lib/auth";
import { getUserSubscription } from "@/lib/billing";

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.user.sub;
  const subscription = await getUserSubscription(userId);
  const planName = subscription.plan === "studio" ? "Studio" : "Starter";
  return (
    <>
      <Suspense fallback={null}>
        <UpgradedBanner planName={planName} />
      </Suspense>
      <DashboardClient
        plan={subscription.plan}
        planStatus={subscription.plan_status}
        currentPeriodEnd={subscription.current_period_end}
        starterPriceId={process.env.STRIPE_PRICE_STARTER || ""}
        studioPriceId={process.env.STRIPE_PRICE_STUDIO || ""}
      />
    </>
  );
}
