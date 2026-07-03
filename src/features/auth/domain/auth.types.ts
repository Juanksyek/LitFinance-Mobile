export type AuthTokens = {
  accessToken: string;
  refreshToken?: string | null;
};

export type LogoutHandler = () => void;

