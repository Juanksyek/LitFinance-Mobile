export const DEFAULT_CONCEPT_ICON = 'pricetag-outline';

/**
 * Icon catalog used by Concepts.
 * Kept in a shared module so other features (e.g. blocs) can reuse it.
 */
const RAW_ICON_CATALOG = [
  'add',
  'airplane-outline',
  'albums-outline',
  'archive-outline',
  'bar-chart-outline',
  'battery-charging-outline',
  'bed-outline',
  'bicycle-outline',
  'boat-outline',
  'book-outline',
  'bus-outline',
  'restaurant-outline',
  'beer-outline',
  'cafe-outline',
  'planet-outline',
  'musical-notes-outline',
  'images-outline',
  'camera-outline',
  'trophy-outline',
  'briefcase-outline',
  'business-outline',
  'analytics-outline',
  'gift-outline',
  'people-outline',
  'server-outline',
  'shirt-outline',
  'calculator-outline',
  'calendar-outline',
  'call-outline',
  'car-outline',
  'cart-outline',
  'cash-outline',
  'chatbubble-outline',
  'cloud-outline',
  'diamond-outline',
  'document-text-outline',
  'football-outline',
  'globe-outline',
  'heart-outline',
  'home-outline',
  'information-circle-outline',
  'key-outline',
  'laptop-outline',
  'leaf-outline',
  'library-outline',
  'list-outline',
  'locate-outline',
  'mail-outline',
  'man-outline',
  'map-outline',
  'mic-outline',
  'moon-outline',
  'newspaper-outline',
  'pause-outline',
  'paw-outline',
  'phone-portrait-outline',
  'pizza-outline',
  'pricetag-outline',
  'ribbon-outline',
  'rocket-outline',
  'save-outline',
  'school-outline',
  'shop-outline',
  'sparkles-outline',
  'star-outline',
  'storefront-outline',
  'train-outline',
  'trash-outline',
  'wallet-outline',
  'watch-outline',
  'water-outline',
  'wine-outline',
  // extras
  'cash-outline',
  'card-outline',
  'create-outline',
  'cut-outline',
  'download-outline',
  'egg-outline',
  'fast-food-outline',
  'file-tray-full-outline',
  'flash-outline',
  'game-controller-outline',
  'hammer-outline',
  'headset-outline',
  'help-circle-outline',
  'ice-cream-outline',
  'infinite-outline',
  'medkit-outline',
  'megaphone-outline',
  'newspaper-outline',
  'notifications-outline',
  'nutrition-outline',
  'options-outline',
  'paper-plane-outline',
  'partly-sunny-outline',
  'paw-outline',
  'person-outline',
  'phone-portrait-outline',
  'pulse-outline',
  'receipt-outline',
  'remove',
  'repeat-outline',
  'shield-checkmark-outline',
  'skull-outline',
  'snow-outline',
  'sunny-outline',
  'sync-outline',
  'ticket-outline',
  'time-outline',
  'today-outline',
  'trending-up-outline',
  'tv-outline',
  'umbrella-outline',
  'videocam-outline',
  'volume-high-outline',
  'warning-outline',
  'wifi-outline',
] as const;

const EXTRA_ICON_ALIASES: Record<string, string[]> = {
  foco: ['bulb-outline', 'flash-outline', 'flashlight-outline', 'sparkles-outline', 'sunny-outline'],
  bombilla: ['bulb-outline', 'lightbulb-outline', 'flash-outline'],
  luz: ['bulb-outline', 'flash-outline', 'sunny-outline', 'partly-sunny-outline'],
  viaje: ['airplane-outline', 'car-outline', 'train-outline'],
  travel: ['airplane-outline', 'car-outline', 'train-outline', 'boat-outline', 'map-outline'],
  trip: ['airplane-outline', 'car-outline', 'train-outline'],
  comida: ['restaurant-outline', 'pizza-outline', 'fast-food-outline', 'cafe-outline'],
  food: ['restaurant-outline', 'pizza-outline', 'fast-food-outline', 'cafe-outline', 'beer-outline', 'wine-outline'],
  restaurant: ['restaurant-outline', 'fast-food-outline', 'cafe-outline'],
  pago: ['card-outline', 'cash-outline', 'wallet-outline', 'receipt-outline'],
  pay: ['card-outline', 'cash-outline', 'wallet-outline', 'receipt-outline'],
  payment: ['card-outline', 'cash-outline', 'wallet-outline', 'receipt-outline'],
  pago_online: ['card-outline', 'card'],
  casa: ['home-outline', 'house-outline'],
  hogar: ['home-outline'],
  home: ['home-outline', 'house-outline'],
  trabajo: ['briefcase-outline', 'laptop-outline'],
  work: ['briefcase-outline', 'laptop-outline', 'business-outline'],
  deporte: ['football-outline'],
  sport: ['football-outline'],
  sports: ['football-outline'],
  regalo: ['gift-outline'],
  gift: ['gift-outline'],
  salud: ['medkit-outline'],
  health: ['medkit-outline', 'pulse-outline'],
  transporte: ['car-outline', 'bus-outline', 'train-outline'],
  transport: ['car-outline', 'bus-outline', 'train-outline'],
  car: ['car-outline', 'bus-outline', 'train-outline'],
  entretenimiento: ['film-outline', 'musical-notes-outline', 'game-controller-outline'],
  entertainment: ['film-outline', 'musical-notes-outline', 'game-controller-outline', 'tv-outline'],
  music: ['musical-notes-outline', 'headset-outline'],
  ahorro: ['piggy-bank-outline', 'save-outline', 'pricetag-outline'],
  save: ['piggy-bank-outline', 'save-outline', 'wallet-outline'],
  savings: ['piggy-bank-outline', 'save-outline', 'wallet-outline'],
};

const EXTRA_ICONS = Array.from(new Set(Object.values(EXTRA_ICON_ALIASES).flat())).filter(Boolean);

export function buildConceptIconCatalog(opts?: { defaultIcon?: string }): string[] {
  const defaultIcon = (opts?.defaultIcon || DEFAULT_CONCEPT_ICON).trim();

  const s = new Set<string>();
  for (const i of RAW_ICON_CATALOG) {
    if (typeof i === 'string' && i.trim()) s.add(i.trim());
  }
  for (const i of EXTRA_ICONS) {
    if (typeof i === 'string' && i.trim()) s.add(i.trim());
  }

  const arr = Array.from(s);
  arr.sort((a, b) => {
    const ao = a.includes('outline') ? 0 : 1;
    const bo = b.includes('outline') ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return a.localeCompare(b);
  });

  if (defaultIcon && !s.has(defaultIcon)) arr.unshift(defaultIcon);
  return arr;
}

function normalizeQuery(value: any): string {
  if (value == null) return '';
  try {
    const s = String(value).toLowerCase().trim();
    return s.normalize ? s.normalize('NFD').replace(/\p{Diacritic}/gu, '') : s;
  } catch {
    return String(value).toLowerCase().trim();
  }
}

/**
 * Shared filtering helper for icon catalogs.
 * Supports searching by icon name and by ES/EN keyword aliases.
 */
export function filterConceptIcons(catalog: string[], query: string): string[] {
  const q = normalizeQuery(query);
  if (!q) return catalog;

  const aliasHits = new Set<string>();
  for (const [k, icons] of Object.entries(EXTRA_ICON_ALIASES)) {
    if (!k) continue;
    if (normalizeQuery(k).includes(q)) {
      for (const icon of icons) aliasHits.add(icon);
    }
  }

  return catalog.filter((name) => {
    const nn = normalizeQuery(name);
    return nn.includes(q) || aliasHits.has(name);
  });
}
