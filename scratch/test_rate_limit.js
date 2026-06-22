const http = require('http');

function attemptLogin(callback) {
  const postData = JSON.stringify({
    correo: 'invalid@maipu.cl',
    password: 'wrongpassword'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      callback(null, res.statusCode, data);
    });
  });

  req.on('error', (err) => {
    callback(err);
  });

  req.write(postData);
  req.end();
}

let attempts = 0;
function runTest() {
  attempts++;
  console.log(`Attempt ${attempts}...`);
  attemptLogin((err, status, body) => {
    if (err) {
      console.error(err);
    } else {
      console.log(`Status: ${status}`);
      console.log(`Response: ${body}`);
      if (attempts < 6) {
        setTimeout(runTest, 100);
      } else {
        console.log('Finished test.');
      }
    }
  });
}

runTest();
