export type Campaign = {
  id: string;
  title: string;
  code: string;
  description: string;
  organizer: string;
  cover: string;
  allowsDirectWithdrawals: boolean;
};

export type FundraiserEvent = Campaign & {
  target: number;
  raised: number;
  contributors: number;
  startDate: string | null;
  deadline: string | null;
};

export const contributionMethods = ["mpesa", "paystack", "pledge"] as const;
export type ContributionMethod = (typeof contributionMethods)[number];

export function contributionPath(method: ContributionMethod, campaign: Pick<Campaign, "id" | "title" | "code">) {
  return `/${method}/${campaign.id}/${encodeURIComponent(campaign.title)}/${encodeURIComponent(campaign.code)}`;
}
