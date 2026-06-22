const http = require('http');
const auth = require('../auth');

const token = auth.signToken({
  id: 4,
  correo: 'abarrazaj@maipu.cl',
  nombre: 'Alejandro Barraza Jopia',
  rol: 'Administrador',
  rut: '12.345.678-9',
  asistido_rut: ''
});

const cookie = `lobby_session=${token}`;

function makeRequest(path, callback) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: path,
    method: 'GET',
    headers: {
      'Cookie': cookie
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        callback(null, res.statusCode, json);
      } catch (err) {
        callback(err, res.statusCode, data);
      }
    });
  });

  req.on('error', (err) => {
    callback(err);
  });

  req.end();
}

console.log('--- Testing /api/solicitudes?page=1&limit=5 ---');
makeRequest('/api/solicitudes?page=1&limit=5', (err, status, body) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Status:', status);
    console.log('Keys in body:', Object.keys(body));
    console.log('totalItems:', body.totalItems);
    console.log('Page:', body.page);
    console.log('Limit:', body.limit);
    console.log('Data length:', body.data ? body.data.length : 'undefined');
    
    console.log('\n--- Testing /api/publicadas?page=1&limit=3 ---');
    makeRequest('/api/publicadas?page=1&limit=3', (err2, status2, body2) => {
      if (err2) {
        console.error('Error:', err2);
      } else {
        console.log('Status:', status2);
        console.log('Keys in body:', Object.keys(body2));
        console.log('totalItems:', body2.totalItems);
        console.log('Page:', body2.page);
        console.log('Limit:', body2.limit);
        console.log('Data length:', body2.data ? body2.data.length : 'undefined');
      }
    });
  }
});
