export interface Moneda {
  codigo: string;
  nombre: string;
  simbolo: string;
}

export const monedasPredefinidas: Moneda[] = [
  { codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: '$' },
  { codigo: 'EUR', nombre: 'Euro', simbolo: '€' },
  { codigo: 'MXN', nombre: 'Peso Mexicano', simbolo: '$' },
  { codigo: 'COP', nombre: 'Peso Colombiano', simbolo: '$' },
  { codigo: 'ARS', nombre: 'Peso Argentino', simbolo: '$' },
  { codigo: 'CLP', nombre: 'Peso Chileno', simbolo: '$' },
  { codigo: 'PEN', nombre: 'Sol Peruano', simbolo: 'S/' },
  { codigo: 'BRL', nombre: 'Real Brasileño', simbolo: 'R$' },
  { codigo: 'CAD', nombre: 'Dólar Canadiense', simbolo: 'C$' },
  { codigo: 'GBP', nombre: 'Libra Esterlina', simbolo: '£' },
  { codigo: 'JPY', nombre: 'Yen Japonés', simbolo: '¥' },
  { codigo: 'CNY', nombre: 'Yuan Chino', simbolo: '¥' },
  { codigo: 'CHF', nombre: 'Franco Suizo', simbolo: 'CHF' },
  { codigo: 'AUD', nombre: 'Dólar Australiano', simbolo: 'A$' },
  { codigo: 'NZD', nombre: 'Dólar Neozelandés', simbolo: 'NZ$' },
  { codigo: 'SEK', nombre: 'Corona Sueca', simbolo: 'kr' },
  { codigo: 'NOK', nombre: 'Corona Noruega', simbolo: 'kr' },
  { codigo: 'DKK', nombre: 'Corona Danesa', simbolo: 'kr' },
  { codigo: 'PLN', nombre: 'Zloty Polaco', simbolo: 'zł' },
  { codigo: 'CZK', nombre: 'Corona Checa', simbolo: 'Kč' },
];

// Función para buscar una moneda por código
export const buscarMonedaPorCodigo = (codigo: string): Moneda | undefined => {
  return monedasPredefinidas.find(moneda => moneda.codigo === codigo);
};

// Función para obtener monedas más comunes (top 10)
export const getMonedasComunes = (): Moneda[] => {
  return monedasPredefinidas.slice(0, 10);
};
