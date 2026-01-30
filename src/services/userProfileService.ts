import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from './authService';
import { API_BASE_URL } from '../constants/api';

export interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  cuentaId: string;
  rol?: string;
  planType?: 'premium_plan' | 'free_plan';
  isPremium?: boolean;
  graficasAvanzadas?: boolean;
  premiumUntil?: string | Date | null;
  premiumSubscriptionStatus?: string | null;
  premiumSubscriptionId?: string | null;
}

class UserProfileService {
  /**
   * Fetches the latest user profile from the backend and updates AsyncStorage
   * Returns the updated profile or null if failed
   */
  async fetchAndUpdateProfile(): Promise<UserProfile | null> {
    try {
      const token = await authService.getAccessToken();
      if (!token) {
        console.warn('[UserProfileService] No access token available');
        return null;
      }

      // Try fetching profile. If we get 401, attempt a token refresh and retry once.
      let response = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        // Access token may be expired; try to refresh tokens and retry one time
        console.warn('[UserProfileService] Received 401, attempting token refresh');
        try {
          const newAccess = await authService.refreshTokens();
          if (newAccess) {
            response = await fetch(`${API_BASE_URL}/user/profile`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${newAccess}`,
                'Content-Type': 'application/json',
              },
            });
          }
        } catch (e) {
          console.error('[UserProfileService] Token refresh failed:', e);
          return null;
        }
      }

      if (!response.ok) {
        console.error(`[UserProfileService] Failed to fetch profile: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const profile: UserProfile = {
        id: data.id,
        nombre: data.nombre,
        email: data.email,
        cuentaId: data.cuentaId,
        rol: data.rol || 'usuario',
        planType: data.planType,
        isPremium: data.isPremium,
        graficasAvanzadas: data.graficasAvanzadas,
        premiumUntil: data.premiumUntil,
        premiumSubscriptionStatus: data.premiumSubscriptionStatus,
        premiumSubscriptionId: data.premiumSubscriptionId,
      };

      // Update AsyncStorage
      await AsyncStorage.setItem('userData', JSON.stringify(profile));
      console.log('✅ [UserProfileService] Profile updated:', {
        isPremium: profile.isPremium,
        planType: profile.planType,
        graficasAvanzadas: profile.graficasAvanzadas,
      });

      return profile;
    } catch (error) {
      console.error('[UserProfileService] Error fetching profile:', error);
      return null;
    }
  }

  /**
   * Gets cached user profile from AsyncStorage
   */
  async getCachedProfile(): Promise<UserProfile | null> {
    try {
      const raw = await AsyncStorage.getItem('userData');
      if (!raw) return null;
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  }

  /**
   * Determines if user can see advanced features
   * Fast path decision for UI rendering
   */
  canSeeAdvanced(profile: UserProfile | null): boolean {
    if (!profile) return false;
    
    // Use planType as source of truth if available
    if (profile.planType) {
      return profile.planType === 'premium_plan';
    }
    
    // Fallback to graficasAvanzadas or isPremium
    if (profile.graficasAvanzadas !== undefined) {
      return profile.graficasAvanzadas;
    }
    
    return profile.isPremium ?? false;
  }
}

export const userProfileService = new UserProfileService();
export default userProfileService;
