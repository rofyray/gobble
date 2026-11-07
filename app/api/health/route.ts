import { connection } from 'next/server';
import { ok } from '@/lib/api';
import { serverStore } from '@/lib/store/server';

export async function GET() {
  await connection();
  return ok({ store: serverStore().kind });
}
