import { getPublicFundraiser } from "@/services/public-fundraiser";
import { Suspense } from "react";
import LoadingSpinner from "@/components/ui/loading-spinner";
import CampaignDetails from "@/components/contributions/campaign-details";

async function CampaignContent({ params }: { params: Promise<{ id: string }> }) {
  const campaign = await getPublicFundraiser((await params).id).catch(() => undefined);
  if (campaign === undefined) return <main className="givva-form-page"><p role="alert">The fundraiser could not load. Refresh to try again.</p></main>;
  if (!campaign) {
    return (
      <main className="givva-form-page">
        <section className="givva-form-card" aria-labelledby="fundraiser-missing">
          <h1 id="fundraiser-missing">Fundraiser unavailable</h1>
          <p className="givva-subtitle">This fundraiser ID was not found in the configured Givva API environment.</p>
        </section>
      </main>
    );
  }
  return <CampaignDetails campaign={campaign} />;
}

export default function ContributionPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<LoadingSpinner />}><CampaignContent params={params} /></Suspense>;
}
