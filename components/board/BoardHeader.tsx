import { copy } from '@/lib/copy';
import { monthDay, to12h, weekday } from '@/lib/engine/time';
import type { PotluckEvent, Report } from '@/lib/engine/types';

export function CompleteBanner({ report, event, animate = false }: { report: Report; event: PotluckEvent; animate?: boolean }) {
  const locked = event.status === 'locked';
  if (!report.complete && !locked) return null;
  return (
    <div className="plan-stamps" role="status">
      {report.complete && <p className={`plan-stamp${animate ? ' stamp-enter' : ''}`}>{copy.board.complete}</p>}
      {locked && <p className="plan-stamp plan-stamp-sub">{copy.board.locked(to12h(event.dinnerTime))}</p>}
    </div>
  );
}

export function BoardHeader({
  event, report, stale = false, animate = false,
}: {
  event: PotluckEvent;
  report: Report;
  stale?: boolean;
  animate?: boolean;
}) {
  return (
    <header className="board-head">
      <div>
        <p className="eyebrow">{copy.board.eyebrow}</p>
        <h1 className="board-title">{event.title}</h1>
        <p className="board-meta">
          {copy.board.meta(weekday(event.date), monthDay(event.date), to12h(event.dinnerTime), event.headcount)}
          {stale && <span className="stale">{copy.board.stale}</span>}
        </p>
      </div>
      <CompleteBanner report={report} event={event} animate={animate} />
    </header>
  );
}
