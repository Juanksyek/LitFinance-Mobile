import { httpClient } from '../../../shared/api/api-client';
import type {
  AccountDeletionMessageResponse,
  VerifyDeletionOtpResponse,
} from '../domain/accountDeletion.types';

const authenticatedOptions = { authenticated: true } as const;

export const accountDeletionApi = {
  request(): Promise<AccountDeletionMessageResponse> {
    return httpClient.post(
      '/auth/request-account-deletion',
      undefined,
      authenticatedOptions,
    );
  },

  verifyOtp(email: string, otp: string): Promise<VerifyDeletionOtpResponse> {
    return httpClient.post(
      '/auth/verify-deletion-otp',
      { email, otp },
      authenticatedOptions,
    );
  },

  confirm(deletionToken: string): Promise<AccountDeletionMessageResponse> {
    return httpClient.post(
      '/auth/confirm-account-deletion',
      { deletionToken },
      authenticatedOptions,
    );
  },
};
