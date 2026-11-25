import type { Env } from './env';

export type RtEvent =
  | { type: 'alert.created'; id: string; severity: string; title: string }
  | { type: 'alert.updated'; id: string; status: string }
  | { type: 'articles.new'; count: number }
  | { type: 'ai.done'; processed: number }
  | { type: 'capture.done' };

export type Publish = (wsId: string, e: RtEvent) => Promise<void>;

/** Fan an event out to every browser connected to the workspace. Best-effort: never blocks or fails the caller. */
export const makePublish = (env: Pick<Env, 'HUB'>): Publish => async (wsId, e) => {
  try {
    const stub = env.HUB.get(env.HUB.idFromName(wsId));
    await stub.fetch('https://hub/broadcast', { method: 'POST', body: JSON.stringify({ ...e, at: Date.now() }) });
  } catch (err) {
    console.warn('realtime publish failed', String((err as Error).message));
  }
};
