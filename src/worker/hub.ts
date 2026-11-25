import { DurableObject } from 'cloudflare:workers';

/**
 * One instance per workspace. Uses WebSocket Hibernation, so idle connections cost nothing.
 * Only the Worker can reach it (via the binding); /broadcast is not exposed publicly.
 */
export class WorkspaceHub extends DurableObject {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/broadcast' && req.method === 'POST') {
      const msg = await req.text();
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.send(msg); } catch { /* socket already gone */ }
      }
      return new Response('ok');
    }
    if (req.headers.get('upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    if (this.ctx.getWebSockets().length >= 250) return new Response('Too many connections', { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: 'hello', at: Date.now() }));
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    if (msg === 'ping') ws.send('pong'); // client heartbeat; everything else is ignored (server → client only)
  }
  webSocketClose(ws: WebSocket, code: number) {
    try { ws.close(code === 1005 ? 1000 : code); } catch { /* already closed */ }
  }
}
