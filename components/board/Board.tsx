'use client';

import { useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { copy } from '@/lib/copy';
import { CATEGORY_ORDER } from '@/lib/engine/menu-thanksgiving';
import type { PotluckEvent, Report } from '@/lib/engine/types';
import { BoardHeader } from './BoardHeader';
import { NextUp, Pass, PassDetails, PassStats } from './Pass';
import { Rail } from './Rail';
import { displayOrder, marksFrom } from './marks';

export interface BoardData { event: PotluckEvent; report: Report }

class FetchError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function fetcher(url: string): Promise<BoardData> {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new FetchError(res.status, json?.error?.message ?? `HTTP ${res.status}`);
  return { event: json.event, report: json.report };
}

// A shared 1s clock. The server snapshot is null so relative times render after hydration.
let clock = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!timer) {
    timer = setInterval(() => {
      clock = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const useNow = () => useSyncExternalStore(subscribe, () => clock, () => null);

interface Diff { slots: Set<string>; claims: Set<string>; plan: boolean }
const NO_DIFF: Diff = { slots: new Set(), claims: new Set(), plan: false };

function diff(prev: Report, next: Report): Diff {
  const before = new Map(prev.slots.map((s) => [s.id, s]));
  const slots = new Set<string>();
  const claims = new Set<string>();
  const known = new Set(prev.slots.flatMap((s) => s.claims.map((c) => c.id)));
  for (const s of next.slots) {
    if (before.get(s.id)?.status !== s.status) slots.add(s.id);
    for (const c of s.claims) if (!known.has(c.id)) claims.add(c.id);
  }
  return { slots, claims, plan: prev.complete !== next.complete };
}

function BoardView({ data, diff: d, stale, error }: { data: BoardData; diff: Diff; stale: boolean; error: boolean }) {
  const now = useNow();
  const { event, report } = data;
  const marks = marksFrom(report);
  const order = displayOrder(report);
  const numberOf = (id: string) => order.indexOf(id) + 1;

  return (
    <main className="board">
      <BoardHeader event={event} report={report} stale={stale} animate={d.plan} />
      {error && <p className="board-error" role="alert">{copy.board.error}</p>}

      <div className="only-narrow board-pass-strip">
        <div className="pass-strip-grid">
          <PassStats report={report} />
          <NextUp report={report} />
        </div>
      </div>

      <div className="board-grid">
        <div className="board-rails">
          {CATEGORY_ORDER.map((cat) => (
            <Rail
              key={cat}
              category={cat}
              slots={report.slots.filter((s) => s.category === cat)}
              numberOf={numberOf}
              changed={d.slots}
              marks={marks}
              freshClaims={d.claims}
            />
          ))}
        </div>
        <aside className="board-pass only-wide">
          <Pass report={report} event={event} now={now} />
        </aside>
      </div>

      <div className="only-narrow board-pass-details">
        <PassDetails report={report} event={event} now={now} />
      </div>

      <footer className="board-foot">{copy.board.footer}</footer>
    </main>
  );
}

export function BoardState({ title, body }: { title: string; body?: string }) {
  return (
    <main className="state">
      <p className="state-title">{title}</p>
      {body && <p className="state-body">{body}</p>}
    </main>
  );
}

const STALE_MS = 10_000;

export function Board({ slug, initial }: { slug: string; initial?: BoardData }) {
  const [lastOk, setLastOk] = useState<number | null>(null);
  const { data, error } = useSWR<BoardData, FetchError>(`/api/events/${slug}`, fetcher, {
    refreshInterval: 2500,
    fallbackData: initial,
    revalidateOnFocus: true,
    onSuccess: () => setLastOk(Date.now()),
  });
  const now = useNow();

  // Keep the previously shown report to decide which tickets get the stamp animation.
  const [shown, setShown] = useState<{ report?: Report; diff: Diff }>({ report: data?.report, diff: NO_DIFF });
  if (data && data.report !== shown.report) {
    setShown({ report: data.report, diff: shown.report ? diff(shown.report, data.report) : NO_DIFF });
  }

  if (error?.status === 404) return <BoardState title={copy.board.notFound.title} body={copy.board.notFound.body} />;
  if (!data) return <BoardState title={copy.board.loading} body={error ? copy.board.error : undefined} />;

  const stale = now !== null && lastOk !== null && now - lastOk > STALE_MS;
  return <BoardView data={data} diff={shown.diff} stale={stale} error={!!error} />;
}
