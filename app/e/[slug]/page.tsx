import { connection } from 'next/server';
import { Suspense } from 'react';
import { Board, BoardState, type BoardData } from '@/components/board/Board';
import { copy } from '@/lib/copy';
import { GobbleError } from '@/lib/engine/errors';
import { planService } from '@/lib/store/server';

async function load(slug: string): Promise<BoardData | 'missing' | undefined> {
  try {
    return await planService().get(slug);
  } catch (err) {
    if (err instanceof GobbleError && err.code === 'NOT_FOUND') return 'missing';
    console.error(err);
    return undefined;
  }
}

async function BoardShell({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const initial = await load(slug);
  if (initial === 'missing') return <BoardState title={copy.board.notFound.title} body={copy.board.notFound.body} />;
  return <Board slug={slug} initial={initial} />;
}

export default function BoardPage({ params }: PageProps<'/e/[slug]'>) {
  return (
    <Suspense fallback={<BoardState title={copy.board.loading} />}>
      <BoardShell params={params} />
    </Suspense>
  );
}
