import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UseSafeApiOptions<T> {
  cacheKey?: string;
  cacheDuration?: number; // milliseconds
  retryAttempts?: number;
  retryDelay?: number;
  debounceMs?: number;
}

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
}

/**
 * Hook personalizado para manejar peticiones API de forma segura
 * Incluye: abort controller, cache, retry logic, debouncing, y cleanup
 */
export function useSafeApi<T>(
  fetchFn: (signal: AbortSignal) => Promise<T>,
  dependencies: any[],
  options: UseSafeApiOptions<T> = {}
) {
  const {
    cacheKey,
    cacheDuration = 30000, // 30 segundos por defecto
    retryAttempts = 2,
    retryDelay = 1000,
    debounceMs = 300,
  } = options;

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
    isStale: false,
  });

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);

  // Función para cargar datos del cache
  const loadFromCache = useCallback(async (): Promise<T | null> => {
    if (!cacheKey) return null;

    try {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (!cachedData) return null;

      const parsed = JSON.parse(cachedData);
      const now = Date.now();

      // Verificar si el cache está vigente
      if (parsed.timestamp && now - parsed.timestamp < cacheDuration) {
        console.log(`[useSafeApi] Cache hit para ${cacheKey}`);
        return parsed.data;
      } else {
        console.log(`[useSafeApi] Cache expirado para ${cacheKey}`);
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }
    } catch (error) {
      console.error('[useSafeApi] Error loading from cache:', error);
      return null;
    }
  }, [cacheKey, cacheDuration]);

  // Función para guardar datos en cache
  const saveToCache = useCallback(
    async (data: T) => {
      if (!cacheKey) return;

      try {
        const cacheData = {
          data,
          timestamp: Date.now(),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log(`[useSafeApi] Datos guardados en cache: ${cacheKey}`);
      } catch (error) {
        console.error('[useSafeApi] Error saving to cache:', error);
      }
    },
    [cacheKey]
  );

  // Función principal para ejecutar el fetch
  const executeFetch = useCallback(async () => {
    // Cancelar cualquier petición anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Crear nuevo AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Intentar cargar desde cache primero
      const cachedData = await loadFromCache();
      if (cachedData && isMountedRef.current) {
        setState({
          data: cachedData,
          loading: false,
          error: null,
          isStale: false,
        });
        // Marcar como stale después de cierto tiempo
        setTimeout(() => {
          if (isMountedRef.current) {
            setState((prev) => ({ ...prev, isStale: true }));
          }
        }, cacheDuration * 0.7); // Marcar como stale al 70% del tiempo de cache
      }

      // Actualizar estado de loading solo si no hay datos en cache
      if (!cachedData && isMountedRef.current) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }

      // Ejecutar fetch
      const data = await fetchFn(signal);

      // Solo actualizar estado si el componente está montado
      if (isMountedRef.current && !signal.aborted) {
        setState({
          data,
          loading: false,
          error: null,
          isStale: false,
        });

        // Guardar en cache
        await saveToCache(data);
        lastFetchTimeRef.current = Date.now();
        retryCountRef.current = 0;
      }
    } catch (error: any) {
      // Ignorar errores de abort
      if (error.name === 'AbortError' || signal.aborted) {
        console.log('[useSafeApi] Petición cancelada');
        return;
      }

      console.error('[useSafeApi] Error en fetch:', error);

      // Retry logic
      if (retryCountRef.current < retryAttempts) {
        retryCountRef.current++;
        console.log(
          `[useSafeApi] Reintentando (${retryCountRef.current}/${retryAttempts})...`
        );
        setTimeout(() => {
          if (isMountedRef.current) {
            executeFetch();
          }
        }, retryDelay * retryCountRef.current);
        return;
      }

      // Solo actualizar estado de error si el componente está montado
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      }
    }
  }, [fetchFn, loadFromCache, saveToCache, retryAttempts, retryDelay, cacheDuration]);

  // Función de refresh manual
  const refresh = useCallback(
    (force: boolean = false) => {
      const now = Date.now();
      const minRefreshInterval = 2000; // Mínimo 2 segundos entre refreshes

      if (!force && now - lastFetchTimeRef.current < minRefreshInterval) {
        console.log('[useSafeApi] Refresh bloqueado: muy pronto desde el último');
        return Promise.resolve();
      }

      // Limpiar debounce timer si existe
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      return executeFetch();
    },
    [executeFetch]
  );

  // Effect para ejecutar fetch con debounce
  useEffect(() => {
    // Marcar como montado
    isMountedRef.current = true;

    // Limpiar debounce timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Configurar nuevo debounce timer
    debounceTimerRef.current = setTimeout(() => {
      executeFetch();
    }, debounceMs);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      
      // Cancelar petición en progreso
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Limpiar debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, dependencies);

  return {
    ...state,
    refresh,
    isLoading: state.loading,
  };
}

/**
 * Hook simplificado para peticiones sin cache
 */
export function useSimpleApi<T>(
  fetchFn: (signal: AbortSignal) => Promise<T>,
  dependencies: any[]
) {
  return useSafeApi(fetchFn, dependencies, {
    cacheDuration: 0,
    retryAttempts: 1,
    debounceMs: 0,
  });
}
