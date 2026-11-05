import { getPublicFundraiser } from "@/services/public-fundraiser";
import { Suspense } from "react";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { notFound } from "next/navigation";
import ContributionForm from "@/components/contributions/contribution-form";
import { contributionMethods } from "@/lib/contribution";

type RouteParams = { method: string; id: string; name: string; code: string };

async function PaymentContent({ params }: { params: Promise<RouteParams> }) {
  const { method, id, code } = await params;
  const selected = contributionMethods.find(value => value === method);
  if (!selected) notFound();
  const campaign = await getPublicFundraiser(id).catch(() => undefined);
  if (campaign === undefined) return <main className="givva-form-page"><p role="alert">The fundraiser could not load. Refresh to try again.</p></main>;
  if (!campaign || code !== campaign.code) notFound();
  if (selected === "paystack" && !campaign.allowsDirectWithdrawals) notFound();
  return (
    <ContributionForm method={selected} title={campaign.title} fundraiserId={campaign.id}
      code={campaign.code} allowsDirectWithdrawals={campaign.allowsDirectWithdrawals} />
  );
}

export default function PaymentPage({ params }: { params: Promise<RouteParams> }) {
  return <Suspense fallback={<LoadingSpinner />}><PaymentContent params={params} /></Suspense>;
}
