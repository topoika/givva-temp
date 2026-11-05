import Image from "next/image";
import { LuChevronDown } from "react-icons/lu";
import { PiCalendarDots, PiHandHeart } from "react-icons/pi";
import { ButtonLink } from "@/components/ui/button";
import GivvaFooter from "@/components/contributions/givva-footer";
import type { FundraiserEvent } from "@/lib/contribution";

const DAY = 86_400_000;

const money = (value: number) => `Kes ${value.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

const formatDate = (value: string | null) => value
  ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" })
  : "Not set";

function daysLeft(deadline: string | null) {
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / DAY));
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="givva-ring" role="img" aria-label={`${percent}% funded`}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r={radius} className="givva-ring-track" />
        <circle
          cx="40" cy="40" r={radius} className="givva-ring-fill"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(percent, 100) / 100)}
        />
      </svg>
      <span>{percent}%</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="givva-event-card givva-event-section" open>
      <summary>
        <h2 className="givva-heading givva-event-heading">{title}</h2>
        <LuChevronDown aria-hidden="true" className="givva-chevron" />
      </summary>
      {children}
    </details>
  );
}

export default function EventDetails({ event }: { event: FundraiserEvent }) {
  const percent = event.target > 0 ? Math.round((event.raised / event.target) * 100) : 0;

  return (
    <main className="givva-campaign">
      <a href="https://givva.world" target="_blank" rel="noopener noreferrer" className="givva-event-banner">
        <Image src="/contributions/givva-logo.png" alt="Givva" width={64} height={48} priority />
        <span>Powered by <span className="givva-event-brand">Givva Wealthtech Limited</span></span>
      </a>
      <article className="givva-campaign-details">
        <div className="givva-event-stack">
          <section className="givva-event-card givva-event-summary">
            <div className="givva-event-image">
              <Image src={event.cover} alt={`Image for ${event.title}`} fill preload sizes="(max-width: 700px) 136px, 200px" />
            </div>
            <div className="givva-event-text">
              <h1 className="givva-heading givva-event-heading">{/\bevent$/i.test(event.title) ? event.title : `${event.title} Event`}</h1>
              {event.description && <p className="givva-event-description">{event.description}</p>}
              {event.organizer && <p className="givva-organizer">By {event.organizer}</p>}
            </div>
          </section>

          <ButtonLink href={`/contribute/${event.id}`}>
            <PiHandHeart aria-hidden="true" />
            Contribute / Pledge
          </ButtonLink>

          {event.allowsDirectWithdrawals && (
            <>
              <Section title="Contribution Progress">
                <div className="givva-progress">
                  <ProgressRing percent={percent} />
                  <div className="givva-progress-info">
                    <p className="givva-progress-raised">{money(event.raised)}</p>
                    <p className="givva-muted">raised of {money(event.target)}</p>
                    <div className="givva-progress-bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(percent, 100)}%` }} />
                    </div>
                    <dl className="givva-progress-stats">
                      <div><dt className="givva-muted">Contributors</dt><dd>{event.contributors}</dd></div>
                      <div><dt className="givva-muted">Days left</dt><dd>{daysLeft(event.deadline)}</dd></div>
                    </dl>
                  </div>
                </div>
              </Section>

              <Section title="Event Dates">
                <div className="givva-dates">
                  <span className="givva-dates-icon"><PiCalendarDots aria-hidden="true" /></span>
                  <dl>
                    <div><dt className="givva-muted">Start Date</dt><dd>{formatDate(event.startDate)}</dd></div>
                    <div><dt className="givva-muted">End Date</dt><dd>{formatDate(event.deadline)}</dd></div>
                  </dl>
                </div>
              </Section>
            </>
          )}
        </div>
        <GivvaFooter />
      </article>
    </main>
  );
}
