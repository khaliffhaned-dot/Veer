// Writes wrangler.local.jsonc = wrangler.jsonc minus the remote-only `ai` binding, so `wrangler dev`
// runs fully offline (D1 + Durable Objects local). Without the binding the AI endpoints answer 503.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const cfg = JSON.parse(src);
delete cfg.ai;
writeFileSync(new URL('../wrangler.local.jsonc', import.meta.url), JSON.stringify(cfg, null, 2));
