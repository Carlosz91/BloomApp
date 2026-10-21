// Shared formatting helpers.

// Catalog prices are whole amounts in guaraníes (₲) or colones (₡), no decimals.
// Manual grouping instead of toLocaleString: Hermes (RN Android) has no
// full Intl support and would swallow the thousands separator.
const agruparMiles = (valor) => {
  const entero = Math.round(Number(valor) || 0);
  return String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const formatGuaranies = (valor) => `₲${agruparMiles(valor)}`;

// El mock de referencia usa guaraníes->colones (₡) para los precios.
export const formatColones = (valor) => `₡${agruparMiles(valor)}`;
