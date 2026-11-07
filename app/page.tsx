import Link from 'next/link';
import { displayOrder, marksFrom } from '@/components/board/marks';
import { Ticket } from '@/components/board/Ticket';
import { copy } from '@/lib/copy';
import { buildReport } from '@/lib/engine/reconcile';
import { demoMid } from '@/lib/engine/fixtures/demo';

const REPO_URL = 'https://github.com/rofyray/gobble';
const HERO_SLOTS = ['veg-main', 'dessert', 'mashed-potatoes', 'stuffing'];

export default function Landing() {
  const report = buildReport(demoMid);
  const marks = marksFrom(report);
  const order = displayOrder(report);
  const hero = HERO_SLOTS.map((id) => report.slots.find((s) => s.id === id)!);
  const l = copy.landing;

  return (
    <div className="landing">
      <header className="landing-head">
        <span className="wordmark">{copy.brand.name}</span>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1 className="hero-title">{l.h1}</h1>
            <p className="hero-lede">{l.lede}</p>
            <div className="hero-ctas">
              <Link className="cta cta-primary" href="/e/demo-mid">{l.ctaPrimary}</Link>
              <a className="cta cta-secondary" href={`${REPO_URL}#run-it-yourself-about-10-minutes`}>{l.ctaSecondary}</a>
            </div>
          </div>
          <div className="hero-stack" aria-hidden>
            {hero.map((slot) => (
              <div key={slot.id} className="hero-ticket">
                <Ticket slot={slot} index={order.indexOf(slot.id) + 1} marks={marks} />
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section" aria-labelledby="how">
          <h2 id="how" className="section-title">{l.howTitle}</h2>
          <ol className="how">
            {l.how.map((step, i) => (
              <li key={step.title} className="ticket-hang">
                <span className="ticket-clip" aria-hidden />
                <article className="ticket how-ticket">
                  <div className="ticket-no">{copy.board.ticketNo(i + 1)}</div>
                  <h3 className="how-title">{step.title}</h3>
                  <p className="how-body">{step.body}</p>
                </article>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="catches">
          <h2 id="catches" className="section-title">{l.catchesTitle}</h2>
          <ul className="catches">
            {l.catches.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="switch">
          <h2 id="switch" className="section-title">{l.switchTitle}</h2>
          <p className="switch-body">{l.switchBody}</p>
        </section>
      </main>

      <footer className="landing-foot">
        <a href={REPO_URL}>{l.footer}</a>
      </footer>
    </div>
  );
}
