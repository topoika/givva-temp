import { Suspense } from "react";
import LoadingSpinner from "@/components/ui/loading-spinner";
import EventDetails from "@/components/contributions/event-details";
import { getPublicFundraiser } from "@/services/public-fundraiser";

async function EventContent({ params }: { params: Promise<{ id: string }> }) {
  const event = await getPublicFundraiser((await params).id).catch(() => undefined);
  if (event === undefined) return <main className="givva-form-page"><p role="alert">The fundraiser could not load. Refresh to try again.</p></main>;
  if (!event) {
    return (
      <main className="givva-form-page">
        <section className="givva-form-card" aria-labelledby="fundraiser-missing">
          <h1 id="fundraiser-missing">Fundraiser unavailable</h1>
          <p className="givva-subtitle">This fundraiser ID was not found in the configured Givva API environment.</p>
        </section>
      </main>
    );
  }
  return <EventDetails event={event} />;
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<LoadingSpinner />}><EventContent params={params} /></Suspense>;
}
