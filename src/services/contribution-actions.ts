"use server";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { apiRequest } from "@/lib/api";
import { contributionMethods, type ContributionMethod } from "@/lib/contribution";
import { validContributionPhone } from "@/lib/contribution-validation";
import { getPublicFundraiser } from "@/services/public-fundraiser";

const statusKey = process.env.GIVVA_PAYMENT_STATUS_SECRET || randomBytes(32);

const verifyError = "Failed to verify beneficiary. Please try again.";
const missingUser = "No user found with this phone number";

/** A short, plain-text message from the Givva API, or the fallback. */
function apiMessage(data: unknown, fallback: string) {
  const message = (data as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim() && message.length <= 200 && message.toLowerCase() !== "ok"
    ? message.trim()
    : fallback;
}

async function findBeneficiary(phone: string) {
  const response = await apiRequest(`users/search?${new URLSearchParams({ phoneNumber: phone })}`, { version: 2 });
  const data = await response.json().catch(() => null);
  if (response.ok && data?.result) {
    const name = typeof data.result.name === "string" ? data.result.name.trim() : "";
    return { ok: true, name: name || "User found" } as const;
  }
  const notFound = response.status === 404 ||
    (response.status === 400 && apiMessage(data, "").toLowerCase() === "the user does not exist");
  return { ok: false, message: notFound ? missingUser : apiMessage(data, verifyError) } as const;
}

export async function verifyBeneficiary(phone: string) {
  if (!validContributionPhone(phone)) return { ok: false, message: "Please enter a valid phone number" } as const;
  try {
    return await findBeneficiary(phone);
  } catch {
    return { ok: false, message: verifyError } as const;
  }
}

type SubmissionResult =
  | { kind: "error"; message: string }
  | { kind: "uncertain"; message: string }
  | { kind: "pledged" }
  | { kind: "checkout"; url: string }
  | { kind: "pending"; paymentId: string; proof: string; message: string };

function paymentProof(id: string) {
  return createHmac("sha256", statusKey).update(`givva-payment-status:${id}`).digest("hex");
}

export async function submitContribution(id: string, method: ContributionMethod, form: FormData): Promise<SubmissionResult> {
  const name = String(form.get("name") ?? "").trim();
  const phoneNumber = String(form.get("phone") ?? "").trim();
  const amount = Number(form.get("amount"));
  const beneficiaryPhoneNumber = String(form.get("beneficiary") ?? "").trim() || null;
  const pledge = method === "pledge";

  if (!contributionMethods.includes(method)) return { kind: "error", message: "This contribution method is unavailable." };
  if (!Number.isFinite(amount) || amount < 1 || amount > Number.MAX_SAFE_INTEGER || (!pledge && !Number.isSafeInteger(amount))) {
    return { kind: "error", message: pledge ? "Enter a pledge amount of at least KES 1." : "Enter a whole amount of at least KES 1." };
  }
  if (!validContributionPhone(phoneNumber)) return { kind: "error", message: "Please enter a valid phone number" };
  if (pledge && !name) return { kind: "error", message: "Name is required." };
  if (name.length > 120) return { kind: "error", message: "Name must be 120 characters or fewer." };

  try {
    const campaign = await getPublicFundraiser(id);
    if (!campaign) return { kind: "error", message: "This fundraiser is unavailable." };
    if (method === "paystack" && !campaign.allowsDirectWithdrawals) {
      return { kind: "error", message: "This fundraiser does not accept Paystack payments." };
    }
    if (!pledge && beneficiaryPhoneNumber) {
      const beneficiary = await verifyBeneficiary(beneficiaryPhoneNumber);
      if (!beneficiary.ok) return { kind: "error", message: beneficiary.message };
    }

    const payload = pledge
      ? { name, phoneNumber, amount, identifier: campaign.code }
      : {
          name: name || "Anonymous", phoneNumber, amount,
          fundraiserId: campaign.id, identifier: null, beneficiaryPhoneNumber,
          ...(method === "paystack" ? { paymentMethod: "PAYSTACK" } : {}),
        };

    const response = await apiRequest(pledge ? `fundraisers/${campaign.id}/public/pledges` : "payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || (typeof data.status === "number" && data.status >= 400) || !data?.result) {
      const fallback = pledge ? "Failed to make pledge. Please try again." : "Failed to initiate payment. Please try again.";
      return { kind: "error", message: apiMessage(data, fallback) };
    }
    if (pledge) return { kind: "pledged" };
    if (method === "paystack") {
      const url = new URL(data.result.authorizationUrl);
      if (url.origin !== "https://checkout.paystack.com" || url.username || url.password) {
        throw new Error("Unexpected checkout destination.");
      }
      return { kind: "checkout", url: url.href };
    }
    const paymentId = typeof data.result === "string" ? data.result : data.result?.id;
    if (typeof paymentId !== "string" || !/^[a-z\d-]{1,128}$/i.test(paymentId)) {
      throw new Error("Missing payment reference.");
    }
    return {
      kind: "pending", paymentId, proof: paymentProof(paymentId),
      message: apiMessage(data, "Check your phone for the M-PESA prompt."),
    };
  } catch {
    return { kind: "uncertain", message: "The result could not be confirmed. Check your payment or pledge status before trying again." };
  }
}

export type PaymentStatus =
  | { state: "confirmed" }
  | { state: "failed"; message: string }
  | { state: "pending" | "unavailable" };

export async function checkContributionPayment(id: string, proof: string): Promise<PaymentStatus> {
  try {
    if (!/^[a-z\d-]{1,128}$/i.test(id) || !/^[a-f\d]{64}$/.test(proof) ||
        !timingSafeEqual(Buffer.from(proof), Buffer.from(paymentProof(id)))) return { state: "unavailable" };
    const response = await apiRequest(`payments/${id}/status`, { signal: AbortSignal.timeout(8000) });
    const result = response.ok ? (await response.json()).result : null;
    if (!result) return { state: "unavailable" };
    if (result.confirmedAt) return { state: "confirmed" };
    if (result.failureReason) {
      const reason = typeof result.failureReason === "string" && result.failureReason.length <= 200 ? result.failureReason : "";
      return { state: "failed", message: reason || "Payment failed. Please try again." };
    }
    return { state: "pending" };
  } catch {
    return { state: "unavailable" };
  }
}
