"use client";

import { useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Button } from "@/components/ui/Button";

const TOPUP_PRICE_IDS: Record<number, string | undefined> = {
  5000: process.env.NEXT_PUBLIC_PADDLE_PRICE_TOPUP_5K,
  15000: process.env.NEXT_PUBLIC_PADDLE_PRICE_TOPUP_15K,
  40000: process.env.NEXT_PUBLIC_PADDLE_PRICE_TOPUP_40K,
};

export function BuyCreditsButton({ credits, userId, workspaceId }: { credits: number; userId: string; workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const [paddle, setPaddle] = useState<Paddle | undefined>();

  const openCheckout = async () => {
    setLoading(true);
    try {
      let instance = paddle;
      if (!instance) {
        instance = await initializePaddle({
          environment: "production",
          token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
        });
        setPaddle(instance);
      }

      const priceId = TOPUP_PRICE_IDS[credits];
      if (!priceId) {
        alert(`Set a NEXT_PUBLIC_PADDLE_PRICE_TOPUP_* env var for the ${credits.toLocaleString()}-credit pack first.`);
        return;
      }

      // topup_credits in custom_data is how the Paddle webhook tells this apart from a
      // subscription-plan purchase and credits the workspace's shared pool instead of
      // changing the plan. workspace_id is the actual credit pool the webhook updates.
      instance?.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: { workspace_id: workspaceId, user_id: userId, topup_credits: credits },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="secondary" onClick={openCheckout} disabled={loading}>
      {loading ? "Loading..." : "Buy"}
    </Button>
  );
}
