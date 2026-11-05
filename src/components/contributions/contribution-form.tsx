"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { FaLock } from "react-icons/fa";
import { LuCircleAlert, LuCircleCheck } from "react-icons/lu";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { contributionPath, type ContributionMethod } from "@/lib/contribution";
import { phonePattern, validContributionPhone } from "@/lib/contribution-validation";
import { checkContributionPayment, submitContribution, verifyBeneficiary } from "@/services/contribution-actions";

type Props = {
  method: ContributionMethod;
  title: string;
  fundraiserId: string;
  code: string;
  allowsDirectWithdrawals: boolean;
};

// Matches the live site: check every 3 seconds, up to 12 times.
const POLL_INTERVAL = 3000;
const POLL_ATTEMPTS = 12;

type Payment = { paymentId: string; proof: string };
type Outcome =
  | { kind: "confirmed" }
  | { kind: "failed" | "timeout"; message: string }
  | { kind: "pledged" }
  | { kind: "uncertain"; message: string };

type Beneficiary = { phone: string; name: string } | { phone: string; error: string };

function Result({ tone, title, children }: { tone: "success" | "error"; title: string; children: ReactNode }) {
  return (
    <div className={`givva-result givva-result-${tone}`} role="status">
      {tone === "success" ? <LuCircleCheck aria-hidden /> : <LuCircleAlert aria-hidden />}
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export default function ContributionForm({ method, title, fundraiserId, code, allowsDirectWithdrawals }: Props) {
  const [forSomeoneElse, setForSomeoneElse] = useState(false);
  const [beneficiaryPhone, setBeneficiaryPhone] = useState("");
  const [beneficiary, setBeneficiary] = useState<Beneficiary>();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payment, setPayment] = useState<Payment>();
  const [paymentMessage, setPaymentMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [polling, setPolling] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();
  const inFlight = useRef(false);

  const pledge = method === "pledge";
  const mpesa = method === "mpesa";
  const campaign = { id: fundraiserId, title, code };
  const backToFundraiser = <ButtonLink href={`/event/${fundraiserId}`}>Back to Fundraiser</ButtonLink>;

  useEffect(() => {
    if (!payment || !polling) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;

    async function poll() {
      if (!payment || cancelled) return;
      const status = await checkContributionPayment(payment.paymentId, payment.proof).catch(() => ({ state: "unavailable" as const }));
      if (cancelled) return;
      count += 1;
      setAttempt(count);
      if (status.state === "confirmed") {
        setOutcome({ kind: "confirmed" });
        setPolling(false);
      } else if (status.state === "failed") {
        setOutcome({ kind: "failed", message: status.message });
        setPolling(false);
      } else if (count >= POLL_ATTEMPTS) {
        setOutcome({ kind: "timeout", message: "Payment confirmation timed out. Please check your M-PESA messages." });
        setPolling(false);
      } else {
        timer = setTimeout(poll, POLL_INTERVAL);
      }
    }

    timer = setTimeout(poll, POLL_INTERVAL);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [payment, polling]);

  function retryConfirmation() {
    setOutcome(undefined);
    setAttempt(0);
    setPolling(true);
  }

  async function verify() {
    const phone = beneficiaryPhone.trim();
    setVerifying(true);
    setBeneficiary(undefined);
    setError("");
    try {
      const result = await verifyBeneficiary(phone);
      setBeneficiary(result.ok ? { phone, name: result.name } : { phone, error: result.message });
    } catch {
      setBeneficiary({ phone, error: "Failed to verify beneficiary. Please try again." });
    } finally {
      setVerifying(false);
    }
  }

  const verifiedBeneficiary = beneficiary && "name" in beneficiary && beneficiary.phone === beneficiaryPhone.trim();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || verifying) return;
    setError("");
    if (forSomeoneElse) {
      if (!beneficiaryPhone.trim()) return setError("Please enter beneficiary phone number.");
      if (!verifiedBeneficiary) return setError("Please verify the beneficiary phone number first.");
    }

    const form = new FormData(event.currentTarget);
    if (!forSomeoneElse) form.delete("beneficiary");
    inFlight.current = true;
    setSubmitting(true);
    try {
      const result = await submitContribution(fundraiserId, method, form);
      if (result.kind === "error") setError(result.message);
      else if (result.kind === "uncertain") setOutcome({ kind: "uncertain", message: result.message });
      else if (result.kind === "pledged") setOutcome({ kind: "pledged" });
      else if (result.kind === "checkout") {
        setPaymentMessage("Redirecting to payment page…");
        window.location.assign(result.url);
        return;
      } else {
        setPayment(result);
        setPaymentMessage(result.message);
        setAttempt(0);
        setPolling(true);
      }
    } catch {
      setOutcome({ kind: "uncertain", message: "The result could not be confirmed. Check your payment or pledge status before trying again." });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const heading = pledge ? `Make pledge for ${title}` : mpesa ? "M-PESA Contribution" : `Paystack Contribution for ${title}`;
  const busy = submitting || verifying || Boolean(paymentMessage && !payment);

  let body: ReactNode;
  if (outcome?.kind === "pledged") {
    body = (
      <Result tone="success" title="Pledge Received!">
        <p>Pledge has been successfully received, please click here to start redeeming your pledge.</p>
        <div className="givva-result-actions">
          <ButtonLink href={contributionPath("mpesa", campaign)}>Give Now (M-Pesa)</ButtonLink>
          {allowsDirectWithdrawals && <ButtonLink href={contributionPath("paystack", campaign)}>Give Now (Paystack)</ButtonLink>}
        </div>
      </Result>
    );
  } else if (outcome?.kind === "confirmed") {
    body = (
      <Result tone="success" title="Payment Successful!">
        <p>Payment confirmed! Thank you for your contribution.</p>
        <p>Thank you for supporting {title}</p>
        {backToFundraiser}
      </Result>
    );
  } else if (outcome?.kind === "failed" || outcome?.kind === "timeout") {
    body = (
      <Result tone="error" title="Payment Not Confirmed">
        <p>{outcome.message}</p>
        <p>If you’re sure you’ve completed the payment, you can retry the confirmation.</p>
        <div className="givva-result-actions">
          <Button variant="submit" onClick={retryConfirmation}>Retry Confirmation</Button>
          {backToFundraiser}
        </div>
      </Result>
    );
  } else if (outcome?.kind === "uncertain") {
    body = (
      <Result tone="error" title="Status Unknown">
        <p>{outcome.message}</p>
        {backToFundraiser}
      </Result>
    );
  } else if (payment) {
    body = (
      <div className="givva-result" role="status">
        <span className="givva-result-spinner" aria-hidden />
        <h2>Processing Payment</h2>
        <p>{paymentMessage}</p>
        <p className="givva-muted">Checking… ({Math.min(attempt + 1, POLL_ATTEMPTS)}/{POLL_ATTEMPTS})</p>
      </div>
    );
  } else {
    const phone = (
      <TextField id="phone" type="tel" autoComplete="tel" placeholder="e.g., 07XXXXXXXX" pattern={phonePattern} required
        label={pledge ? "Phone Number" : "Phone Number (used for payment)"}
        title="Use a Kenyan mobile number, e.g. 0712345678" />
    );
    body = (
      <form onSubmit={submit} className="givva-form">
        <TextField id="name" autoComplete="name" maxLength={120} required={pledge}
          label={pledge ? "Full Name" : "Full Name (optional)"}
          placeholder={pledge ? "Enter your full name" : "Enter your full name or leave blank for Anonymous"} />
        {mpesa && phone}
        <TextField id="amount" type="number" inputMode={pledge ? "decimal" : "numeric"} min="1" step={pledge ? "0.01" : "1"} required
          label={pledge ? "How much would you like to pledge?" : mpesa ? "Amount (KES)" : "How much do you want to deposit?"}
          placeholder={mpesa ? "Enter amount" : "Enter amount (KES)"} />
        {!mpesa && phone}
        {!pledge && (
          <>
            <label className="givva-checkbox">
              <input type="checkbox" checked={forSomeoneElse} onChange={event => {
                setForSomeoneElse(event.target.checked);
                setBeneficiaryPhone("");
                setBeneficiary(undefined);
                setError("");
              }} />
              Contribute for someone else
            </label>
            {forSomeoneElse && (
              <TextField id="beneficiary" fieldClassName="givva-beneficiary" type="tel" placeholder="e.g., 07XXXXXXXX"
                label="Beneficiary Phone Number" pattern={phonePattern} required
                value={beneficiaryPhone} disabled={busy}
                onChange={event => { setBeneficiaryPhone(event.target.value); setBeneficiary(undefined); setError(""); }}
                action={
                  <Button variant="verify" disabled={busy || !validContributionPhone(beneficiaryPhone.trim())} onClick={verify}>
                    {verifying ? "Verifying…" : "Verify"}
                  </Button>
                }
                hint={beneficiary && beneficiary.phone === beneficiaryPhone.trim() && (
                  "name" in beneficiary
                    ? <p className="givva-notice givva-notice-success" role="status">Verified: {beneficiary.name}</p>
                    : <p className="givva-notice givva-notice-error" role="alert">{beneficiary.error}</p>
                )} />
            )}
          </>
        )}
        <Button variant="submit" type="submit" disabled={busy}>
          {submitting ? "Processing…" : paymentMessage ? paymentMessage : pledge ? "Make Pledge" : "Contribute Now"}
        </Button>
        {error && <p className="givva-notice givva-notice-error" role="alert">{error}</p>}
      </form>
    );
  }

  return (
    <main className="givva-form-page">
      <section className="givva-form-card" aria-labelledby="contribution-title">
        <h1 id="contribution-title">{outcome || payment ? (pledge ? "Pledge" : "Payment Confirmation") : heading}</h1>
        {!outcome && !payment && (
          <p className="givva-subtitle">{pledge ? "Fill out the form below to make a pledge" : `Fill out the form below to contribute via ${mpesa ? "M-PESA" : "Paystack"}`}</p>
        )}
        {body}
        <p className="givva-privacy"><FaLock aria-hidden />Your information is secure and will not be shared</p>
      </section>
    </main>
  );
}
