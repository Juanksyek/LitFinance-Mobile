const DIAS_SEMANA = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysUntil(iso: string, tipo?: string, valor?: string): number {
  try {
    // When the backend provides an ISO timestamp for next run, compare using UTC
    // date components to avoid local timezone shifts turning a future UTC-midnight
    // date into "yesterday" in local time (which produced 0 days left).
    const nowLocal = new Date();
    const targetCandidate = new Date(String(iso ?? ""));
    const isoValid = !Number.isNaN(targetCandidate.getTime());

    if (isoValid) {
      // Compare by UTC date (year/month/day) to get whole-day difference independent of local TZ
      const nowUTC = Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate());
      const tgtUTC = Date.UTC(
        targetCandidate.getUTCFullYear(),
        targetCandidate.getUTCMonth(),
        targetCandidate.getUTCDate()
      );
      const diffDays = Math.round((tgtUTC - nowUTC) / 86400000);
      return Math.max(0, diffDays);
    }

    // Fallback: if no valid ISO, derive from frequency rules (local dates are fine here)
    let target = startOfDay(new Date());
    if (tipo === "dia_mes" && valor) {
      const day = parseInt(String(valor), 10);
      if (!isNaN(day) && day >= 1 && day <= 31) {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        t.setDate(day);
        if (t < startOfDay(new Date())) t.setMonth(t.getMonth() + 1);
        target = t;
      }
    }

    const diff = startOfDay(target).getTime() - startOfDay(new Date()).getTime();
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
      if (valor) {
        // valor format "M-D" e.g. "7-20" means July 20
        const parts = String(valor).split('-');
        if (parts.length === 2) {
          const m = parseInt(parts[0], 10);
          const d = parseInt(parts[1], 10);
          if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return `Cada ${d} de ${MESES[m - 1]}`;
          }
        }
        // Fallback: try as ISO date
        try {
          const dt = new Date(valor);
          if (!isNaN(dt.getTime())) {
            return `Cada ${dt.getUTCDate()} de ${MESES[dt.getUTCMonth()]}`;
          }
        } catch {}
      }
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
    if (valor) {
      // valor format "M-D" e.g. "7-20" means July 20
      const parts = String(valor).split('-');
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10);
        const d = parseInt(parts[1], 10);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return `El ${d} de ${MESES[m - 1]}`;
        }
      }
      // Fallback: try as ISO date
      try {
        const dt = new Date(valor);
        if (!isNaN(dt.getTime())) return `El ${dt.getUTCDate()} de ${MESES[dt.getUTCMonth()]}`;
      } catch {}
    }
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
