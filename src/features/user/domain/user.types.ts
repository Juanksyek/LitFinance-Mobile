export type FavoriteCurrency = Record<string, unknown>;

export type ToggleFavoriteCurrencyResponse = {
  message: string;
  esFavorita: boolean;
  monedasFavoritas: FavoriteCurrency[];
};

export type FavoriteCurrenciesResponse = {
  monedasFavoritas: FavoriteCurrency[];
  detalles?: unknown;
};

export type PublicUser = {
  nombre?: string;
};

