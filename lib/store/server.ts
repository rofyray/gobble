// Store selection for the Next.js server: Redis when configured, else the local JSON files.
import { PlanService } from '../service';
import { fileStore } from './index';
import { RedisStore } from './redis-store';
import type { Store } from './store';

export function redisEnv(env = process.env): { url: string; token: string } | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

let cached: Store | undefined;

export function serverStore(): Store {
  if (!cached) {
    const redis = redisEnv();
    cached = redis ? new RedisStore(redis.url, redis.token) : fileStore(process.cwd());
  }
  return cached;
}

export const planService = () => new PlanService(serverStore());
