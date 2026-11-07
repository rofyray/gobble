import { authorized, fail, failFrom, ok, readJson, siteUrl } from '@/lib/api';
import { createSchema, zodMessage } from '@/lib/schema';
import { boardUrlFor } from '@/lib/service';
import { planService } from '@/lib/store/server';

export async function POST(req: Request) {
  if (!authorized(req)) return fail('UNAUTHORIZED', 'Missing or wrong agent token.');
  try {
    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail('INVALID', zodMessage(parsed.error));
    const { event, report, did } = await planService().create(parsed.data);
    return ok({ slug: event.slug, boardUrl: boardUrlFor(siteUrl(req), event.slug), did, event, report });
  } catch (err) {
    return failFrom(err);
  }
}
