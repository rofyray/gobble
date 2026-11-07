import { authorized, fail, failFrom, ok, readJson } from '@/lib/api';
import { opSchema, zodMessage } from '@/lib/schema';
import { planService } from '@/lib/store/server';

export async function POST(req: Request, ctx: RouteContext<'/api/events/[slug]/ops'>) {
  const { slug } = await ctx.params;
  if (!authorized(req)) return fail('UNAUTHORIZED', 'Missing or wrong agent token.');
  try {
    const parsed = opSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail('INVALID', zodMessage(parsed.error));
    const { did, fresh, event, report } = await planService().op(slug, parsed.data);
    return ok({ did, fresh, event, report });
  } catch (err) {
    return failFrom(err);
  }
}
