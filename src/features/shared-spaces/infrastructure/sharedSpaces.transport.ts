import {
  httpClient,
  type HttpRequestOptions,
} from '../../../shared/api/api-client';

const SHARED_PATH = '/shared';

export const sharedSpacesTransport = {
  fetch(path: string, options: HttpRequestOptions = {}): Promise<Response> {
    return httpClient.raw(path, {
      ...options,
      authenticated: true,
    });
  },

  request<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    return httpClient.request<T>(path, {
      ...options,
      authenticated: true,
    });
  },

  get<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'GET',
    });
  },

  post<T>(path: string, body?: unknown, options: HttpRequestOptions = {}): Promise<T> {
    return httpClient.post<T>(path, body, {
      ...options,
      authenticated: true,
    });
  },

  patch<T>(path: string, body?: unknown, options: HttpRequestOptions = {}): Promise<T> {
    return httpClient.patch<T>(path, body, {
      ...options,
      authenticated: true,
    });
  },

  put<T>(path: string, body?: unknown, options: HttpRequestOptions = {}): Promise<T> {
    return httpClient.put<T>(path, body, {
      ...options,
      authenticated: true,
    });
  },

  delete<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    return httpClient.delete<T>(path, {
      ...options,
      authenticated: true,
    });
  },

  path(path: string): string {
    return `${SHARED_PATH}${path.startsWith('/') ? path : `/${path}`}`;
  },
};
