import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, loadEnv, runCli } from './run';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

loadEnv(process.cwd());
const result = await runCli(process.argv.slice(2), { repoRoot, env: process.env });
process.stdout.write(`${format(result)}\n`);
process.exitCode = result.code;
