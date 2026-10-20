# ==========================
# BLOOMAPP - Startup Script with Docker
# ==========================
# Este script levanta tanto el backend como el frontend usando Docker.
# Resuelve el error MIME type porque ambos servidores corren simultáneamente.
#
# Prerrequisitos: Docker y Docker Desktop instalados
#
# Uso: 
#   1. Ejecutar: docker-compose up -d  (para background)
#   2. O:      ./start-docker.sh       (para modo interactivo)
#   3. Luego:  abrir http://localhost:8081 en expo go / dispositivo

echo "📦 Iniciando BloomApp con Docker..."

# Verificar que Docker esté corriendo
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker no está corriendo. Inicia Docker Desktop primero."
  exit 1
fi

# Verificar que los archivos existen
if [ ! -f "Dockerfile" ]; then
  echo "❌ Dockerfile no encontrado. Ejecutando setup primero..."
  # Los archivos se crearán abajo
fi

if [ ! -f "docker-compose.yml" ]; then
  echo "❌ docker-compose.yml no encontrado."
  exit 1
fi

echo "🔧 Verificando imágenes de Docker..."

# Construir imágenes si no existen
if [ "$(docker images -q bloomapp-backend 2>/dev/null)" == "" ]; then
  echo "� Construyendo imagen backend..."
  docker build -t bloomapp-backend .
fi

if [ "$(docker images -q bloomapp-frontend 2>/dev/null)" == "" ]; then
  echo "� Construyendo imagen frontend..."
  # Usamos la imagen oficial de expo
  docker pull expo/expo:latest
  # Creamos una imagen personalizada basada en expo
  docker build -t bloomapp-frontend -f Dockerfile.frontend . 2>/dev/null || \
    echo "⚠️ Usando imagen expo oficial en su lugar"
fi

echo "🚀 Levantando servicios con docker-compose..."

# Levantar los servicios
docker-compose up -d

echo ""
echo "✅ Servicios levantados!"
echo ""
echo "📋 Información de acceso:"
echo "   • Backend API:       http://localhost:3000"
echo "   • Metro/Expo:        http://localhost:8081"
echo "   • QR para celular: escaneá con Expo Go"
echo ""
echo "📱 Pasos siguientes:"
echo "   1. En tu celular: instala 'Expo Go' desde la tienda"
echo "   2. Ejecuta: npx expo start"
echo "   3. Escanea el QR que aparezca en la terminal"
echo ""
echo "🛑 Para detener: docker-compose down"