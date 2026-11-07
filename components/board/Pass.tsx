import { copy } from '@/lib/copy';
import type { Activity, Allergen, Diet, OvenPlan, PotluckEvent, Report } from '@/lib/engine/types';
import { toMinutes, to12h, to12hShort } from '@/lib/engine/time';

export function PassStats({ report }: { report: Report }) {
  const p = copy.board.pass;
  const { required, owned, blocking, warnings } = report.counts;
  return (
    <div className="stats">
      <div>
        <p className="stat-value">{p.owned(owned, required)}</p>
        <p className="stat-label">{p.ownedLabel}</p>
      </div>
      <div>
        <p className="stat-value">{p.blocking(blocking)}</p>
        <p className="stat-label">{p.blockingLabel(blocking)}</p>
      </div>
      <div>
        <p className="stat-value">{p.warnings(warnings)}</p>
        <p className="stat-label">{p.warningsLabel(warnings)}</p>
      </div>
    </div>
  );
}

export function NextUp({ report }: { report: Report }) {
  const p = copy.board.pass;
  return (
    <section>
      <h3 className="pass-section-title">{p.nextTitle}</h3>
      {report.next ? (
        <>
          <p className="next-hint">{report.next.hint}</p>
          {report.next.askHandles.length > 0 && (
            <p className="next-ask">{report.next.askHandles.map((h) => `@${h}`).join(' ')}</p>
          )}
        </>
      ) : (
        <p className="next-hint">{p.nothing}</p>
      )}
    </section>
  );
}

export function TableStrip({ table }: { table: Report['table'] }) {
  const p = copy.board.pass;
  const parts = [
    ...Object.entries(table.diets).map(([d, n]) => p.diet(d as Diet, n!)),
    ...Object.entries(table.allergies).map(([a, n]) => p.allergy(a as Allergen, n!)),
  ];
  return (
    <section>
      <h3 className="pass-section-title">{p.tableTitle}</h3>
      <p className={`pass-text${parts.length ? '' : ' soft'}`}>{parts.length ? parts.join(' · ') : p.tableEmpty}</p>
    </section>
  );
}

export function OvenStrip({ oven, dinnerTime, event }: { oven: OvenPlan; dinnerTime: string; event: PotluckEvent }) {
  const p = copy.board.pass;
  const conflicts = event.claims.filter((c) => oven.conflicts.includes(c.id));
  let body: React.ReactNode;
  if (!oven.turkey || !oven.window) {
    body = <p className="pass-text soft">{p.ovenFree}</p>;
  } else {
    const start = toMinutes(oven.turkey.start);
    const total = Math.max(1, toMinutes(dinnerTime) - start);
    const turkeyPct = ((toMinutes(oven.turkey.end) - start) / total) * 100;
    body = (
      <>
        <div className="oven-track" role="img" aria-label={p.turkey(to12h(oven.turkey.start), to12h(oven.turkey.end))}>
          <div className="oven-turkey" style={{ width: `${turkeyPct}%` }}>
            {p.turkey(to12hShort(oven.turkey.start), to12hShort(oven.turkey.end))}
          </div>
          <div className="oven-window" style={{ flex: 1 }} />
        </div>
        <div className="oven-axis mono" aria-hidden>
          <span>{to12hShort(oven.turkey.start)}</span>
          <span>{to12hShort(oven.window.start)}</span>
          <span>{to12hShort(dinnerTime)}</span>
        </div>
        {(oven.rewarm.length > 0 || conflicts.length > 0) && (
          <ul className="oven-list">
            {oven.rewarm.map((r) => (
              <li key={r.claimId} className="oven-item">
                {p.rewarm} · {r.item} · @{r.handle} · {copy.board.oven(r.minutes)}
              </li>
            ))}
            {conflicts.map((c) => (
              <li key={c.id} className="oven-item is-conflict">
                {copy.board.stamps.oven} · {c.item} · @{c.handle} · {copy.board.oven(c.ovenMinutes)}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }
  return (
    <section>
      <h3 className="pass-section-title">{p.ovenTitle}</h3>
      {body}
    </section>
  );
}

function ago(at: string, now: number | null): string {
  if (now === null) return '';
  const mins = Math.max(0, Math.floor((now - Date.parse(at)) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

export function ActivityTicker({ activity, now }: { activity: Activity[]; now: number | null }) {
  const p = copy.board.pass;
  const lines = [...activity].reverse().slice(0, 6);
  const newest = lines[0];
  return (
    <section>
      <h3 className="pass-section-title">{p.activityTitle}</h3>
      <ol className="ticker">
        {lines.map((a, i) => (
          <li key={`${a.at}-${i}`}>
            <time dateTime={a.at}>{ago(a.at, now)}</time>
            <span>{a.text}</span>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">{newest?.text}</p>
    </section>
  );
}

export function PassDetails({ report, event, now }: { report: Report; event: PotluckEvent; now: number | null }) {
  return (
    <>
      <TableStrip table={report.table} />
      <OvenStrip oven={report.oven} dinnerTime={event.dinnerTime} event={event} />
      <ActivityTicker activity={event.activity} now={now} />
    </>
  );
}

/** The full pass, for wide screens. */
export function Pass({ report, event, now }: { report: Report; event: PotluckEvent; now: number | null }) {
  return (
    <div className="pass">
      <h2 className="pass-title">{copy.board.pass.title}</h2>
      <PassStats report={report} />
      <NextUp report={report} />
      <PassDetails report={report} event={event} now={now} />
    </div>
  );
}
