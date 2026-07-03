export type LatestResponseMeta = {
  requestId?: string;
  serverTime?: string;
  retryAfterSeconds?: number;
  nextCursor?: string | null;
};

type Listener = (meta: LatestResponseMeta) => void;

let latestResponseMeta: LatestResponseMeta = {};
const listeners = new Set<Listener>();

export function setLatestResponseMeta(meta: LatestResponseMeta): void {
  latestResponseMeta = {
    ...latestResponseMeta,
    ...meta,
  };

  listeners.forEach((listener) => {
    try {
      listener(latestResponseMeta);
    } catch {
      // ignore listener errors
    }
  });
}

export function getLatestResponseMeta(): LatestResponseMeta {
  return latestResponseMeta;
}

export function subscribeLatestResponseMeta(listener: Listener): () => void {
  listeners.add(listener);
  listener(latestResponseMeta);
  return () => {
    listeners.delete(listener);
  };
}
