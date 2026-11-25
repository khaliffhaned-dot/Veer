export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Optional: set to "true" in wrangler vars to allow open sign-up of new workspaces. */
  ALLOW_SIGNUP?: string;
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
