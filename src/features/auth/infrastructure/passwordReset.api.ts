import { httpClient } from '../../../shared/api/api-client';
import type {
  RequestPasswordOtpResponse,
  ResetPasswordResponse,
  VerifyPasswordOtpResponse,
} from '../domain/passwordReset.types';

export const passwordResetApi = {
  requestOtp(email: string): Promise<RequestPasswordOtpResponse> {
    return httpClient.post('/auth/forgot-password-otp', { email });
  },

  verifyOtp(email: string, otp: string): Promise<VerifyPasswordOtpResponse> {
    return httpClient.post('/auth/verify-reset-otp', { email, otp });
  },

  resetPassword(
    resetToken: string,
    newPassword: string,
  ): Promise<ResetPasswordResponse> {
    return httpClient.post('/auth/reset-password-otp', {
      resetToken,
      newPassword,
    });
  },
};
