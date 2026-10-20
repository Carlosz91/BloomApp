# Spec: Imágenes editoriales Unsplash con atribución

## Overview
Integración con Unsplash API para obtener imágenes de alta calidad para usar en el app BloomApp, con atribución automática y cumplimiento de licencias.

## API Provider: Unsplash

### Endpoints

#### GET Random Image (sin query específica)

```
GET https://api.unsplash.com/photos/random
```

**Headers required:**
- `Authorization: Client-ID <ACCESS_KEY>`
- `Accept-Version: v1` (opcional)

**Query Parameters opcionales:**
- `query`: string - palabras clave (ej: "beauty salon", "spa", "hair")
- `count`: number (1-10) - múltiples imágenes
- `orientation`: landscape | portrait | squarish
- `w`: number - ancho en píxeles (ej: 800, 1200, 1920)
- `h`: number - alto en píxeles

**Respuesta exitosa (200):**
```json
{
  "id": "12345678",
  "urls": {
    "full": "https://unsplash.com/photo/XXXXX",
    "regular": "https://unsplash.com/photo/XXXXX?w=1080",
    "small": "https://unsplash.com/photo/XXXXX?w=400",
    "thumb": "https://unsplash.com/photo/XXXXX?w=200"
  },
  "links": {
    "self": "https://api.unsplash.com/photos/12345678",
    "html": "https://unsplash.com/photo/12345678",
    "download": "https://unsplash.com/photos/12345678/download"
  },
  "user": {
    "id": "98765432",
    "username": "fotografo-unsplash",
    "name": "Nombre Fotógrafo",
    "portfolio": "https://unsplash.com/@fotografo-unsplash"
  },
  "description": "Descripción opcional de la foto",
  "alt_description": "Descripción alternativa para accessibility",
  "width": 3000,
  "height": 2000
}
```

#### GET Search Images

```
GET https://api.unsplash.com/search/photos
```

**Query Parameters obligatorios:**
- `query`: string - búsqueda por palabras clave
- `per_page`: number (1-30) - resultados por página
- `page`: number (1-indexed)

**Respuesta:** Array de objetos con misma estructura que random.

## Licensing & Attribution

### Requisitos Unsplash (free tier)

1. **Atribución requerida** cuando se usan > 10 imágenes/día o en aplicación comercial
2. **Formato atribución:** "Foto de {nombre_fotógrafo} en Unsplash"
3. **Ubicación:** Pié de página, pantalla "Acerca de", o inmediatamente debajo de cada imagen
4. **No requerida:** Menos de 10 imágenes/día en uso personal (aunque recomendado siempre)

### Atribución automática requerida en BloomApp

Cada imagen usada en la app debe mostrar:

```
📸 Foto de {nombre_fotógrafo} en Unsplash
```

### Component Atribution

| Componente | Contenido | Posición |
|------------|-----------|----------|
| `UnsplashAttribution` | `Foto de {username} en Unsplash` | Debajo de cada imagen editora |
| `UnsplashCreditLink` | Enlace a perfil del fotógrafo | Opcional, tap navigable |

## Integración en BloomApp

### Donde se usan imágenes Unsplash

| Pantalla/Área | Uso | Frecuencia |
|----------------|-----|------------|
| Onboarding Screen | Cards de bienvenida (3 imágenes) | 1ra vez por usuario |
| Home Banner | Header hero image | Siempre visible |
| Service Card preview | Miniatura servicios (opcional) | Por categoría |
| Profile Background | Fondo perfil de user | Opcional |

### Componente UnsplashImage (reutilizable)

```javascript
const UnsplashImage = ({ query, alt = 'Servicio LÚMINA', style }) => {
  const [image, setImage] = useState(null);
  const [attribution, setAttribution] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImage = async () => {
      const res = await fetch(
        `https://api.unsplash.com/photos/random?query=${query}&client_id=${UNSPLASH_KEY}`
      );
      const data = await res.json();
      
      setImage(data.urls.small);
      setAttribution(`Foto de ${data.user.username} en Unsplash`);
      setLoading(false);
    };
    fetchImage();
  }, [query]);

  if (loading) return <ActivityIndicator size="small" />;
  if (!image) return <Text style={styles.placeholder}>Imagen no disponible</Text>;

  return (
    <>
      <Image source={{ uri: image }} style={style} resize="cover" />
      <Text style={styles.attribution}>
        {attribution}
      </Text>
    </>
  );
};
```

### Manejo de errores

| Escenario | UI Response |
|-----------|-------------|
| API rate limit (429) | Toast "Límite de imágenes agotado, usando placeholder" + fallback local |
| Sin conexión network | Placeholder local con texto "Sin imagen" |
| Foto inválida/borrada | Usar siguiente imagen random de la lista |
| Usuario revoca acceso | Mostrar aviso "Imágenes por cortesía de Unsplash" |

### Cache & Performance

- **Memoization:** Guardar imágenes en Engram topic_key `unsplash-images/bloomapp` por query
- **Throttle:** Mínimo 1 request cada 30 segundos por query distinta
- **Lazy load:** Imágenes cargan solo cuando la pantalla es visible
- **Thumbnail first:** Cargar `urls.thumb` primero, `urls.full` on-demand
- **Memory cleanup:** Al cambiar de screen, limpiar cache de imágenes no usadas

### Engram Integration (modo hybrid)

Cada vez que se carga una imagen Unsplash:

```
topic_key: unsplash-images/bloomapp/{query}
content: {
  imageUrl: string (small),
  attribution: string,
  fetchedAt: ISO8601 timestamp,
  query: string
}
```

Esto permite:
- Recuperar imágenes anteriores sin nueva API call
- Cross-session recovery (al reiniciar app)
- Stat tracking: cuántas imágenes usadas por query

## Muestras de búsqueda por pantalla

| Pantalla | Query Sugerida | Cantidad |
|----------|---------------|----------|
| Onboarding | "salon beauty studio" | 3 imágenes (1 por card) |
| Home Banner | "luxury spa interior" | 1 imagen |
| Service Cards | "hair salon interior" | Por cada categoría (2: cejas, rostro) |
| Profile | "user profile illustration" | Opcional, 1 imagen |

## Rate Limiting & Quotas

| Plan | Llamadas/hora | Lámina/día | Costo |
|------|--------------|------------|-------|
| Free | 50 | 10 | $0 |
| Pro | 1000 | 30 | $/mes |
| Enterprise | Personal | Personal | Custom |

**Recomendación BloomApp:** Plan Free es suficiente. Usar máximo 8-10 imágenes/día. Implementar cache fuerte para no exceder quotas.

## Fallback Strategy

Cuando Unsplash falla o se excede quota:

1. **Imágenes locales del assets/**: Usar `icon.png`, `favicon.png` como fallback
2. **Colores sólidos con texto**: Componente `SolidColorImage` con iniciales y fondo de paleta
3. **Toast aviso:** "Imágenes por cortesía de Unsplash - servicio temporalmente no disponible"

### Componente SolidColorImage (fallback)

```javascript
const SolidColorImage = ({ initials, size = 100, palette = 'ciruela' }) => {
  const colors = {
    ciruela: '#6B3752',
    marfil: '#8B7355', 
    salvia: '#5A9FAF'
  };
  
  const bgColor = colors[palette];
  
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        borderRadius: size / 4,
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size / 3 }}>
        {initials}
      </Text>
    </View>
  );
};
```

## Design Tokens (atribución style)

```
Atribución texto: #8F9B96 (salvia - tono medio sobre fondos claros)
Atribución fondo: transparente o #F5E9DC (ciruela muy claro)
Tamaño fuente: 10px (mobile) / 12px (tablet)
Familia fuente: System / inter caption
Espaciado: 2px entre "Foto de" y nombre, 4px después "en Unsplash"
Icono: ⬡ (circle) o Ionicons `logo-unsplash` si disponible
```

## API Contract Summary

| Endpoint | Method | Query | Headers | Response Key |
|----------|--------|-------|---------|--------------|
| Random | GET | `query?`, `orientation?`, `w?`, `h?` | `Authorization: Client-ID ...` | `urls.small`, `user.username` |
| Search | GET | `query`, `per_page`, `page` | `Authorization: Client-ID ...` | Array de objects |

### Errores comunes

| Código | Mensaje | UI Response |
|--------|---------|-------------|
| 401 | Unauthorized | Limpiar client ID, reconfigurar |
| 429 | Too Many Requests | Toast + espera 1 hora + usar cache |
| 500 | Server Error | Toast + fallback local |
| 403 | Forbidden | Verificar Client-ID en .env |

## Acceptance Criteria
- [ ] Componente UnsplashImage carga imágenes exitosamente desde API
- [ ] Atribución `Foto de {username} en Unsplash` muestra debajo de cada imagen
- [ ] Fallback local cuando API falla o quota agotado
- [ ] Cache en Engram evita requests redundantes mismo query
- [ ] Rate limiting respetado (máx 8 calls/hora aprox)
- [ ] 3 imágenes onboarding sin bloquear flujo principal
- [ ] Contraste átribución/texto legible (mínimo 4.5:1)
- [ ] Todas las imágenes tienen `alt_description` para accessibility
- [ ] Búsqueda por query retorna resultados relevantes
- [ ] Client ID configurado en .env y nunca expuesto en código cliente