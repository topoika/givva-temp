import "server-only";
import { cache } from "react";
import { apiRequest } from "@/lib/api";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const amount = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const count = (...values: unknown[]) => amount(values.find(value => typeof value === "number"));

// The API returns East Africa Time without an offset, e.g. "2026-10-29 00:00:00".
function apiDate(value: unknown) {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(text(value));
  return match ? `${match[1]}T${match[2]}+03:00` : null;
}

function coverUrl(value: unknown) {
  try {
    const url = new URL(text(value));
    if (url.origin === "https://images.givva.world" && url.pathname !== "/") return url.href;
  } catch {
    // Fall back to the bundled SOWA image.
  }
  return "/contributions/default-cover.png";
}

export const getPublicFundraiser = cache(async (id: string) => {
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) return null;

  const response = await apiRequest(`fundraisers/${id}/public`, {
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json();
  if (response.status === 404 || (response.status === 400 &&
      text(payload?.message).toLowerCase() === "the fundraiser does not exist")) return null;

  const result: Record<string, unknown> | undefined = payload?.result;
  if (!response.ok || !result || text(result.id).toLowerCase() !== id.toLowerCase()) {
    throw new Error("The public fundraiser could not load.");
  }
  const title = text(result.name);
  const code = text(result.identifier);
  if (!title || !code) throw new Error("The public fundraiser response is incomplete.");

  return {
    id, title, code,
    description: text(result.shortDescription),
    organizer: text(result.communityName) || text(result.groupName),
    cover: coverUrl(result.images),
    target: amount(result.targetAmount),
    raised: amount(result.totalContributions),
    contributors: count(result.totalContributors, result.contributorsCount, result.numberOfContributors),
    startDate: apiDate(result.startDate),
    deadline: apiDate(result.deadline),
    allowsDirectWithdrawals: result.allowsDirectWithdrawals !== false,
  };
});
