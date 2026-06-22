const fs = require('fs');
const path = require('path');
const vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'views.js'), 'utf8');
try {
  new vm.Script(code, { filename: 'public/js/views.js' });
  console.log('Syntax OK!');
} catch (e) {
  console.error('Syntax Error found:');
  console.error(e.stack || e.message);
}
