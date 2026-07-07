import { httpClient } from '../../../shared/api/api-client';
import type { UserProfile } from '../domain/profile.types';

export const profileApi = {
  getCurrent(): Promise<UserProfile> {
    return httpClient.get('/user/profile', { authenticated: true });
  },
};
