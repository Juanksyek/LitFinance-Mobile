const DIAS_SEMANA = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysUntil(iso: string, tipo?: string, valor?: string): number {
  try {
    const now = startOfDay(new Date());
    // Prefer an explicit ISO `proximaEjecucion` provided by the backend when available
    // Fallback to deriving a target date from the frequency rule only when `iso` is missing/invalid.
    let target = new Date(String(iso ?? ''));
    const isoValid = !Number.isNaN(target.getTime());

    if (!isoValid) {
      // For monthly rules derive the next matching day-of-month when ISO is not present
      if (tipo === 'dia_mes' && valor) {
        const day = parseInt(valor, 10);
        if (!isNaN(day) && day >= 1 && day <= 31) {
          const t = new Date();
          t.setHours(0, 0, 0, 0);
          t.setDate(day);
          if (t < now) t.setMonth(t.getMonth() + 1);
          target = t;
        }
      } else {
        // If no special rule, and no ISO, default to now (0 days)
        target = new Date();
        target.setHours(0, 0, 0, 0);
      }
    }

    // Normalize to start of day to get whole-day differences
    const targetDay = startOfDay(target);
    const diff = targetDay.getTime() - now.getTime();
    return Math.max(0, Math.round(diff / 86400000));
  } catch {
    return 0;
  }
}

export function estimatedCycleDays(tipo?: string, valor?: string): number {
  if (!tipo) return 30;
  if (tipo === 'dia_semana') return 7;
  if (tipo === 'dia_mes') return 30;
  if (tipo === 'fecha_fija' || tipo === 'fecha_anual') return 365;
  if (tipo === 'dias') {
    const n = Number(valor ?? Number.NaN);
    return Number.isFinite(n) && n > 0 ? n : 30;
  }
  return 30;
}

export function describeFrequencyShort(tipo?: string, valor?: string): string {
  if (!tipo) return 'Cada período';
  try {
    if (tipo === 'dias') {
      const n = Number(valor) || 1;
      return `Cada ${n} día${n === 1 ? '' : 's'}`;
    }
    if (tipo === 'dia_semana') {
      // valor could be single index or csv
      if (!valor) return 'Cada semana';
      const parts = String(valor).split(',');
      if (parts.length === 1) {
        const idx = Number(parts[0]);
        if (!Number.isNaN(idx) && idx >=0 && idx < DIAS_SEMANA.length) return `Cada ${DIAS_SEMANA[idx]}`;
      }
      return `Cada semana`;
    }
    if (tipo === 'dia_mes') {
      if (!valor) return 'Cada mes';
      const v = Number(valor);
      if (!Number.isNaN(v)) return `Cada mes el día ${v}`;
      return 'Cada mes';
    }
    if (tipo === 'fecha_fija' || tipo === 'fecha_anual') {
      // valor could be ISO date
      try {
        const d = new Date(valor || '');
        if (!isNaN(d.getTime())) {
          return `Cada ${d.getDate()} de ${MESES[d.getMonth()]}`;
        }
      } catch {}
      return 'Anual';
    }
  } catch {}
  return 'Cada período';
}

export function describeFrequencyLong(tipo?: string, valor?: string): string {
  if (!tipo) return 'Frecuencia desconocida';
  if (tipo === 'dias') {
    const n = Number(valor) || 1;
    return `Cada ${n} día${n === 1 ? '' : 's'}`;
  }
  if (tipo === 'dia_semana') {
    if (!valor) return 'Cada semana';
    const parts = String(valor).split(',').map(p => p.trim());
    if (parts.length === 1 && parts[0].length > 0) {
      const idx = Number(parts[0]);
      if (!Number.isNaN(idx) && idx >=0 && idx < DIAS_SEMANA.length) return `Cada ${DIAS_SEMANA[idx]}`;
    }
    return `Cada semana (${parts.join(', ')})`;
  }
  if (tipo === 'dia_mes') {
    const v = Number(valor);
    if (!Number.isNaN(v)) return `Cada mes el día ${v}`;
    return 'Cada mes';
  }
  if (tipo === 'fecha_fija' || tipo === 'fecha_anual') {
    try {
      const d = new Date(valor || '');
      if (!isNaN(d.getTime())) return `El ${d.getDate()} de ${MESES[d.getMonth()]}`;
    } catch {}
    return 'Anual';
  }
  return 'Frecuencia desconocida';
}

export function progressFractionFromDays(daysLeft: number, cicloDays: number) {
  if (cicloDays <= 0) return 0;
  const frac = clamp(1 - daysLeft / cicloDays, 0, 1);
  return Math.round(frac * 100) / 100;
}

export default {
  daysUntil,
  estimatedCycleDays,
  describeFrequencyShort,
  describeFrequencyLong,
  progressFractionFromDays,
};
