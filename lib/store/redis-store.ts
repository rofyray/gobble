import { Redis } from '@upstash/redis';
import type { PotluckEvent } from '../engine/types';
import type { Store } from './store';

const key = (slug: string) => `gobble:event:${slug}`;

export class RedisStore implements Store {
  kind = 'redis' as const;
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async get(slug: string): Promise<PotluckEvent | null> {
    return (await this.redis.get<PotluckEvent>(key(slug))) ?? null;
  }

  async put(event: PotluckEvent): Promise<void> {
    await this.redis.set(key(event.slug), event);
  }
}
