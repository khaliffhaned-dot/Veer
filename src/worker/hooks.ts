import { aiConfig, enrich } from './ai';
import type { Env } from './env';
import { makePublish } from './realtime';

/** Post-ingest AI enrichment; a no-op unless the workspace opted in and the binding exists. */
export const enrichHook = (env: Env) => async (wsId: string) => {
  if (!env.AI) return;
  const r = await enrich(env.DB, env.AI, aiConfig(env), wsId, { limit: 25 });
  if (r.processed) await makePublish(env)(wsId, { type: 'ai.done', processed: r.processed });
};
