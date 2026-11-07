import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PotluckEvent } from '../engine/types';
import type { Store } from './store';

const SLUG = /^[a-z0-9-]{1,40}$/;

export class FileStore implements Store {
  kind = 'file' as const;
  constructor(private dir: string) {}

  private file(slug: string) {
    if (!SLUG.test(slug)) throw new Error(`bad slug: ${slug}`);
    return path.join(this.dir, `${slug}.json`);
  }

  async get(slug: string): Promise<PotluckEvent | null> {
    if (!SLUG.test(slug)) return null;
    try {
      return JSON.parse(await readFile(this.file(slug), 'utf8')) as PotluckEvent;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /** Atomic: write a tmp file, then rename over the target. */
  async put(event: PotluckEvent): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const target = this.file(event.slug);
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(event, null, 2));
    await rename(tmp, target);
  }
}
