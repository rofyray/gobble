import type { PotluckEvent } from '../engine/types';

export interface Store {
  kind: 'redis' | 'file';
  get(slug: string): Promise<PotluckEvent | null>;
  put(event: PotluckEvent): Promise<void>;
}
