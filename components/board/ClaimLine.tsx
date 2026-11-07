import { copy } from '@/lib/copy';
import type { Claim } from '@/lib/engine/types';

export function ClaimLine({
  claim, flagged = false, doubled = false, ovenClash = false, fresh = false,
}: {
  claim: Claim;
  flagged?: boolean;
  doubled?: boolean;
  ovenClash?: boolean;
  fresh?: boolean;
}) {
  const serves = copy.board.serves(claim.servings);
  const tags = claim.tags.map((t) => ({ tag: t, text: `[${copy.board.tags[t]}]`, alert: flagged && t.startsWith('contains-') }));
  return (
    <li className={`claim${doubled ? ' is-doubled' : ''}${fresh ? ' line-enter' : ''}`}>
      <div>
        <span className="claim-who">@{claim.handle}</span> · {claim.item}
      </div>
      <div className="claim-sub">
        {serves && <span>{serves}</span>}
        {tags.map((t) => (
          <span key={t.tag} className={t.alert ? 'claim-alert' : undefined}>{t.text}</span>
        ))}
        {claim.labeled && <span>[{copy.board.labeled}]</span>}
        {claim.tentative && <span>{copy.board.tentative}</span>}
        {claim.ovenMinutes > 0 && (
          <span className={ovenClash ? 'claim-alert' : undefined}>{copy.board.oven(claim.ovenMinutes)}</span>
        )}
      </div>
    </li>
  );
}
