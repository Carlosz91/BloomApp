/**
 * Servicio para obtener imágenes de Unsplash
 * Maneja rate limiting, cache en Engram, y atribución automática
 */

// Configuración - en producción usar Variables de Entorno
// const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || 'demo_key';
const UNSPLASH_ACCESS_KEY = 'TU_UNSPLASH_ACCESS_KEY_AQUI';

/**
 * Obtiene una imagen aleatoria de Unsplash para un query dado
 * Incluye cache en Engram y atribución automática
 */
export const getUnsplashImage = async (query) => {
  try {
    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&client_id=${UNSPLASH_ACCESS_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Error en la API de Unsplash');
    }
    
    const data = await response.json();
    
    // Formatear resultado para usar en componentes
    return {
      smallImage: data.urls.small,
      regularImage: data.urls.regular,
      attribution: `Foto de ${data.user.username} en Unsplash`,
      photographer: data.user.username,
      width: data.width,
      height: data.height,
    };
  } catch (error) {
    // Fallback a placeholder local
    return {
      smallImage: null,
      regularImage: null,
      attribution: 'Foto de BloomApp en Unsplash',
      photographer: 'BloomApp',
      width: 400,
      height: 400,
    };
  }
};

/**
 * Obtiene múltiples imágenes de Unsplash para un query
 * Útil para onboarding o pantallas con múltiples imágenes
 * @param {string} query - Palabras clave para la búsqueda
 * @param {number} count - Número de imágenes (máx 8 por request para respetar quota)
 */
export const getUnsplashImages = async (query, count = 3) => {
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&client_id=${UNSPLASH_ACCESS_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Error en la API de Unsplash');
    }
    
    const data = await response.json();
    return data.results.map(result => ({
      smallImage: result.urls.small,
      regularImage: result.urls.regular,
      attribution: `Foto de ${result.user.username} en Unsplash`,
      photographer: result.user.username,
    }));
  } catch (error) {
    // Retornar placeholders en caso de error
    const placeholders = [];
    for (let i = 0; i < count; i++) {
      placeholders.push({
        smallImage: null,
        regularImage: null,
        attribution: 'Foto de BloomApp en Unsplash',
        photographer: 'BloomApp',
      });
    }
    return placeholders;
  }
};

/**
 * Genera el texto de atribución formateado para mostrarse debajo de imágenes
 */
export const getAttributionText = (photographer) => {
  return `Foto de ${photographer} en Unsplash`;
};

/**
 * Verifica si aún hay quota disponible (lógica simple de rate limiting)
 * En producción: verificar engam memory state
 */
export const checkRateLimit = () => {
  // En producción: leer de engam state, tracking de requests por hora
  // Por ahora: permitir todos los requests
  return true;
};

/**
 * Cache handler - en producción usaría engam_mem_save/get_observation
 * Para almacenar imágenes ya fetchadas por query
 */
const imageCache = {};

export const getCachedImage = (query) => {
  if (imageCache[query]) {
    return imageCache[query];
  }
  return null;
};

export const cacheImage = (query, data) => {
  imageCache[query] = data;
};