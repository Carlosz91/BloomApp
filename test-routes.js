// Test script to verify routes are registered
const fs = require('fs');
const content = fs.readFileSync('src/server.js', 'utf8');

// Check for route patterns
const routes = [
  "/auth/register",
  "/auth/login", 
  "/services",
  "/appointments"
];

console.log('=== Verificando routes en server.js ===\n');
routes.forEach(route => {
  const found = content.includes(\`app.post('\${route}')\` || content.includes(\`app.get('\${route}')\`);
  console.log(\`- \${route}: \${found ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}\`);
});

console.log('\n=== Verificando middleware auth ===');
const hasAuthMiddleware = content.includes('authenticateToken');
console.log(\`- authenticateToken middleware: \${hasAuthMiddleware ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}\`);

console.log('\n=== Verificando db imports y setup ===');
const hasDb = content.includes('const db = require');
console.log(\`- db import: \${hasDb ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}\`);

console.log('\n=== Verificando .env load ===');
const hasEnv = content.includes('require(\"dotenv\").config');
console.log(\`- dotenv config: \${hasEnv ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}\`);