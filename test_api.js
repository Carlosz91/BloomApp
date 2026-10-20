// Test script para verificar los endpoints del backend BloomApp
const http = require('http');

// Helper function para hacer requests
function makeRequest(options, callback) {
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      callback(res.statusCode, data);
    });
  });
  req.on('error', (e) => console.error(e));
  req.end();
}

// 1. Register
makeRequest({
  hostname: 'localhost',
  port: 3000,
  path: '/auth/register',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (status, body) => {
  console.log('1. Register Status:', status);
  console.log('1. Register Body:', body);
  
  // 2. Login
  makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@bloomapp.com', password: '123456' })
  }, (status2, body2) => {
    console.log('2. Login Status:', status2);
    console.log('2. Login Body:', body2);
    
    // 3. Services
    makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/services',
      method: 'GET'
    }, (status3, body3) => {
      console.log('3. Services Status:', status3);
      console.log('3. Services Body:', body3);
      
      // 4. Intentemos obtener appointments con un token inventado (fallará por auth pero probaremos la route)
      makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/health',
        method: 'GET'
      }, (status4, body4) => {
        console.log('4. Health Status:', status4);
        console.log('4. Health Body:', body4);
        console.log('\n--- Todos los endpoints probados ---');
      });
    });
  });
});