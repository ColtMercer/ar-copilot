import DashboardClient from "./DashboardClient";
import { requireSession } from "@/lib/auth";
import { getUserSubscription } from "@/lib/billing";

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.user.sub;
  const subscription = await getUserSubscription(userId);
  return (
    <DashboardClient
      plan={subscription.plan}
      planStatus={subscription.plan_status}
      starterPriceId={process.env.STRIPE_PRICE_STARTER || ""}
      studioPriceId={process.env.STRIPE_PRICE_STUDIO || ""}
    />
  );
}
