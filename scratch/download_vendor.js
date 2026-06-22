const fs = require('fs');
const path = require('path');
const https = require('https');

const vendorDir = path.join(__dirname, '..', 'public', 'vendor');
if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}

const urls = {
  'tailwind.js': 'https://cdn.tailwindcss.com',
  'lucide.min.js': 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
  'html2pdf.bundle.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'chart.js': 'https://cdn.jsdelivr.net/npm/chart.js'
};

function download(filename, url) {
  const dest = path.join(vendorDir, filename);
  const file = fs.createWriteStream(dest);

  function getUrl(targetUrl) {
    https.get(targetUrl, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const resolvedUrl = new URL(response.headers.location, targetUrl).toString();
        getUrl(resolvedUrl);
      } else {
        response.pipe(file);
        response.on('end', () => {
          file.close();
          console.log(`Downloaded ${filename}`);
        });
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      console.error(`Error downloading ${filename}:`, err.message);
    });
  }

  getUrl(url);
}

for (const [name, url] of Object.entries(urls)) {
  download(name, url);
}
