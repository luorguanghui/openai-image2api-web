import type { Request } from "express";

export type UserRole = "admin" | "user";

export interface AuthUserSummary {
  id: string;
  username?: string;
  role: UserRole;
}

export interface AuthUser extends AuthUserSummary {
  username: string;
  enabled: boolean;
  apiKey?: string | null;
  hasApiKey: boolean;
  canUseAdminApiKey: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicUser {
  id: string;
  username: string;
  role: UserRole;
  enabled: boolean;
  hasApiKey: boolean;
  canUseAdminApiKey: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  authToken?: string;
}
