import path from 'node:path';
import { FileStore } from './file-store';
import type { Store } from './store';

export type Env = Record<string, string | undefined>;

export type { Store } from './store';
export { FileStore } from './file-store';

/** The local data folder: GOBBLE_DATA_DIR, else <root>/.gobble-data. */
export function dataDir(root: string, env: Env = process.env): string {
  return env.GOBBLE_DATA_DIR || path.join(root, '.gobble-data');
}

export function fileStore(root: string, env: Env = process.env): Store {
  return new FileStore(dataDir(root, env));
}
