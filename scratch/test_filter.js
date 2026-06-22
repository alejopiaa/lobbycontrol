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

const fullUrl = '/api/solicitudes?page=1&limit=5&folio=&nombre=&cargo=&sujetoActivoRepresentado=&estado=Aceptada';
console.log('--- Testing ' + fullUrl + ' ---');
makeRequest(fullUrl, (err, status, body) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Status:', status);
    console.log('totalItems:', body.totalItems);
    console.log('Data length:', body.data ? body.data.length : 'undefined');
    if (body.data) {
      console.log('States of returned items:', body.data.map(item => item.estado));
    }
  }
});
