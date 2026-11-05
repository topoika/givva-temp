import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import GivvaFooter from "@/components/contributions/givva-footer";
import { contributionPath, type Campaign, type ContributionMethod } from "@/lib/contribution";

const actions: { method: ContributionMethod; label: string }[] = [
  { method: "mpesa", label: "Give now (MPESA)" },
  { method: "paystack", label: "Give now (Other Payment Methods)" },
  { method: "pledge", label: "Make a Pledge" },
];

export default function CampaignDetails({ campaign }: { campaign: Campaign }) {
  return (
    <main className="givva-campaign">
      <article className="givva-campaign-details">
        <div className="givva-cover">
          <Image src={campaign.cover} alt={`Image for ${campaign.title}`} fill preload sizes="(max-width: 700px) calc(100vw - 48px), (max-width: 1280px) calc(100vw - 160px), 1120px" />
        </div>
        <h1 className="givva-heading givva-campaign-title">{campaign.title}</h1>
        <p className="givva-description">{campaign.description}</p>
        {campaign.organizer && <p className="givva-organizer">By {campaign.organizer}</p>}
        <nav aria-label="Contribution options" className="givva-actions">
          {actions
            .filter(({ method }) => method !== "paystack" || campaign.allowsDirectWithdrawals)
            .map(({ method, label }) => <ButtonLink href={contributionPath(method, campaign)} key={method}>{label}</ButtonLink>)}
        </nav>
        <GivvaFooter />
      </article>
    </main>
  );
}
