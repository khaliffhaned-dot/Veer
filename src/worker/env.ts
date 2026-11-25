export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Optional: set to "true" in wrangler vars to allow open sign-up of new workspaces. */
  ALLOW_SIGNUP?: string;
  /** Realtime fan-out: one Durable Object per workspace. */
  HUB: DurableObjectNamespace;
  /** Workers AI. Optional so the app still runs where the binding is unavailable. */
  AI?: import('./ai').AiBinding;
  AI_TEXT_MODEL?: string;
  AI_EMBED_MODEL?: string;
  AI_MERGE_THRESHOLD?: string;
}

export type Role = 'viewer' | 'analyst' | 'manager' | 'owner';
export const ROLE_RANK: Record<Role, number> = { viewer: 0, analyst: 1, manager: 2, owner: 3 };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface Vars {
  user: AuthUser;
  wsId: string;
  role: Role;
}

export type AppEnv = { Bindings: Env; Variables: Vars };
