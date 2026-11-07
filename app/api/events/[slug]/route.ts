import { failFrom, ok } from '@/lib/api';
import { planService } from '@/lib/store/server';

export async function GET(_req: Request, ctx: RouteContext<'/api/events/[slug]'>) {
  const { slug } = await ctx.params;
  try {
    const { event, report } = await planService().get(slug);
    return ok({ event, report });
  } catch (err) {
    return failFrom(err);
  }
}
