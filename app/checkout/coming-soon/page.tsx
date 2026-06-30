import { redirect } from "next/navigation";
import { createPurchaseIntent } from "@/lib/purchases";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ product?: string; work?: string }>;
};

export default async function CheckoutComingSoonPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const productId = params.product ?? null;
  const workId = params.work ?? null;

  if (productId || workId) {
    await createPurchaseIntent({
      productId,
      workId,
      sourceContext: "checkout_redirect_to_credits",
      metadata: { route: "/checkout/coming-soon", redirected_to: "/checkout/credits" },
    });
  }

  redirect("/checkout/credits");
}
