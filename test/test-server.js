const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Server</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .info { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Test Server Running</h1>
        <div class="info">
          <p><strong>Request Headers:</strong></p>
          <pre>${JSON.stringify(req.headers, null, 2)}</pre>
          <p><strong>URL:</strong> ${req.url}</p>
          <p><strong>Method:</strong> ${req.method}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        </div>
      </body>
    </html>
  `);
});

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});