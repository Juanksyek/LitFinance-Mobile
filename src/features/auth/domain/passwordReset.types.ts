export type RequestPasswordOtpResponse = {
  ok?: boolean;
  message?: string;
};

export type VerifyPasswordOtpResponse = {
  resetToken: string;
};

export type ResetPasswordResponse = {
  ok?: boolean;
  message?: string;
};

