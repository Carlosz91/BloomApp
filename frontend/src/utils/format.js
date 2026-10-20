// Shared formatting helpers.

// Catalog prices are whole amounts in guaraníes (PYG, no decimals).
// Manual grouping instead of toLocaleString: Hermes (RN Android) has no
// full Intl support and would swallow the thousands separator.
export const formatGuaranies = (valor) => {
  const entero = Math.round(Number(valor) || 0);
  return `₲${String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
};
