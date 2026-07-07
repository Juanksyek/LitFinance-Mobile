import { useCallback, useState } from 'react';

export function useAsyncTaskState<TKey extends string>(
  initialState: Record<TKey, boolean>,
) {
  const [state, setState] = useState<Record<TKey, boolean>>(initialState);

  const setTask = useCallback(
    (key: TKey, value: boolean) => {
      setState(prev => {
        if (prev[key] === value) return prev;
        return {
          ...prev,
          [key]: value,
        };
      });
    },
    [],
  );

  const mergeTasks = useCallback((patch: Partial<Record<TKey, boolean>>) => {
    setState(prev => {
      let changed = false;
      const next = { ...prev };

      (Object.keys(patch) as TKey[]).forEach(key => {
        const value = patch[key];
        if (typeof value !== 'boolean' || prev[key] === value) return;
        changed = true;
        next[key] = value;
      });

      return changed ? next : prev;
    });
  }, []);

  const runTask = useCallback(
    async <TResult>(
      key: TKey,
      task: () => Promise<TResult>,
    ): Promise<TResult> => {
      setTask(key, true);
      try {
        return await task();
      } finally {
        setTask(key, false);
      }
    },
    [setTask],
  );

  const isAnyActive = useCallback(
    (...keys: TKey[]) => {
      if (keys.length === 0) return Object.values(state).some(Boolean);
      return keys.some(key => Boolean(state[key]));
    },
    [state],
  );

  return {
    state,
    setTask,
    mergeTasks,
    runTask,
    isAnyActive,
  };
}
