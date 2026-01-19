import type { EmbyCredentials } from '../protocols/emby/types';
import type { NavidromeCredentials } from '../protocols/navidrome/types';

export type AuthCredentials = EmbyCredentials | NavidromeCredentials;

export type AuthState = {
  isAuthenticated: boolean;
  credentials: AuthCredentials | null;
};
