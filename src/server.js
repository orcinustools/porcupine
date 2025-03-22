const net = require('net');
const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const ssh2 = require('ssh2');
const fs = require('fs');
const path = require('path');
const debug = require('debug')('porcupine:server');
const SSLManager = require('./ssl-manager');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

class TunnelServer {
  constructor(options = {}) {
    this.sshPort = options.sshPort || 2222;
    this.httpPort = options.httpPort || 80;
    this.httpsPort = options.httpsPort || 443;
    this.useSSL = options.ssl || false;
    this.sslManager = null;
    this.hosts = new Map();
    this.connections = new Map();
    
    try {
      this.hostKey = fs.readFileSync(path.join(__dirname, '..', 'keys', 'ssh_host_key'));
      this.authorizedKeys = this.loadAuthorizedKeys();
    } catch (err) {
      console.error('Error loading keys:', err);
      console.error('Please run: npm run generate-keys');
      process.exit(1);
    }

    this.setupSSHServer();
    this.setupHTTPServer();
  }

  loadAuthorizedKeys() {
    const keys = new Set();
    try {
      const content = fs.readFileSync(
        path.join(__dirname, '..', 'keys', 'authorized_keys'),
        'utf8'
      );
      content.split('\n').forEach(line => {
        if (line.trim()) {
          const key = Buffer.from(line.trim().split(' ')[1], 'base64');
          keys.add(key.toString('base64'));
        }
      });
    } catch (err) {
      console.warn('Warning: Could not read authorized_keys file');
    }
    return keys;
  }

  setupSSHServer() {
    this.sshServer = new ssh2.Server({
      hostKeys: [this.hostKey],
      algorithms: {
        kex: [
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
          'diffie-hellman-group-exchange-sha256'
        ],
        cipher: [
          'aes128-gcm',
          'aes256-gcm',
          'aes128-ctr',
          'aes256-ctr'
        ],
        serverHostKey: [
          'ssh-rsa',
          'ecdsa-sha2-nistp256',
          'ssh-ed25519'
        ]
      }
    }, (client) => {
      debug('New SSH connection');

      client.on('authentication', (ctx) => {
        if (ctx.method === 'publickey') {
          const clientKey = ctx.key.data.toString('base64');
          if (this.authorizedKeys.has(clientKey)) {
            debug('Authentication successful');
            return ctx.accept();
          }
        }
        debug('Authentication failed');
        ctx.reject();
      });

      client.on('ready', () => {
        debug('Client authenticated');
      });

      client.on('request', (accept, reject, name, info) => {
        if (name === 'tcpip-forward') {
          const host = info.bindAddr.toLowerCase();
          if (this.isValidHostname(host)) {
            this.hosts.set(host, client);
            const port = accept();
            debug(`Tunnel established for ${host} (local port: ${info.bindPort})`);
            
            // Store connection info
            this.connections.set(client, {
              host,
              port: info.bindPort,
              channels: new Set()
            });
          } else {
            reject();
          }
        } else if (name === 'cancel-tcpip-forward') {
          const host = info.bindAddr.toLowerCase();
          this.hosts.delete(host);
          accept();
          debug(`Tunnel removed for ${host}`);
        } else {
          reject();
        }
      });

      client.on('error', (err) => {
        debug('SSH client error:', err);
      });

      client.on('close', () => {
        debug('Client disconnected');
        const connection = this.connections.get(client);
        if (connection) {
          this.hosts.delete(connection.host);
          this.connections.delete(client);
        }
      });
    });
  }

  async setupHTTPServer() {
    const proxy = httpProxy.createProxyServer({});
    const createRequestHandler = () => async (req, res) => {
      const fullHost = req.headers.host?.toLowerCase();
      const host = fullHost?.split(':')[0];  // Remove port if present
      
      debug(`Incoming request for host: ${host} (full: ${fullHost})`);
      debug(`Available hosts: ${Array.from(this.hosts.keys()).join(', ')}`);
      
      if (!host || !this.hosts.has(host)) {
        debug(`Host ${host} not found in registered hosts`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>404 Not Found</title></head>
            <body>
              <center><h1>404 Not Found</h1></center>
              <hr><center>Porcupine Tunnel Server</center>
            </body>
          </html>
        `);
        return;
      }

      const client = this.hosts.get(host);
      const connection = this.connections.get(client);

      if (!connection) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway');
        return;
      }

      debug(`Proxying request to localhost:${connection.port}`);
      proxy.web(req, res, {
        target: `http://localhost:${connection.port}`,
        headers: {
          host: host
        }
      });
    });

    proxy.on('error', (err, req, res) => {
      debug('Proxy error:', err);
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway');
    });

    // Create HTTP server
    this.httpServer = http.createServer(createRequestHandler());

    // Create HTTPS server if SSL is enabled
    if (this.useSSL) {
      if (!this.sslManager) {
        this.sslManager = await new SSLManager(this.options).init();
      }

      // Create HTTPS server with auto SSL
      this.httpsServer = https.createServer({
        SNICallback: async (domain, cb) => {
          try {
            const certs = await this.sslManager.getCertificate(domain);
            cb(null, require('tls').createSecureContext(certs));
          } catch (err) {
            debug(`SSL Error for ${domain}:`, err);
            cb(err);
          }
        }
      }, createRequestHandler());

      // Start certificate renewal check
      setInterval(() => {
        this.sslManager.renewCertificates().catch(err => {
          debug('Certificate renewal error:', err);
        });
      }, 24 * 60 * 60 * 1000); // Check daily
    }
  }

  isValidHostname(hostname) {
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(hostname);
  }

  async start() {
    const startPromises = [
      // Start SSH server
      new Promise((resolve, reject) => {
        this.sshServer.listen(this.sshPort, '0.0.0.0', (err) => {
          if (err) reject(err);
          else {
            console.log(`SSH server listening on 0.0.0.0:${this.sshPort}`);
            resolve();
          }
        });
      }),

      // Start HTTP server
      new Promise((resolve, reject) => {
        this.httpServer.listen(this.httpPort, '0.0.0.0', (err) => {
          if (err) reject(err);
          else {
            console.log(`HTTP server listening on 0.0.0.0:${this.httpPort}`);
            resolve();
          }
        });
      })
    ];

    // Start HTTPS server if SSL is enabled
    if (this.useSSL) {
      startPromises.push(
        new Promise((resolve, reject) => {
          this.httpsServer.listen(this.httpsPort, '0.0.0.0', (err) => {
            if (err) reject(err);
            else {
              console.log(`HTTPS server listening on 0.0.0.0:${this.httpsPort}`);
              resolve();
            }
          });
        })
      );
    }

    return Promise.all(startPromises);
  }
}

if (require.main === module) {
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('ssl', {
      type: 'boolean',
      description: 'Enable SSL/HTTPS support',
      default: false
    })
    .option('email', {
      type: 'string',
      description: 'Email for Let\'s Encrypt registration',
      default: 'anak10thn@gmail.com'
    })
    .option('staging', {
      type: 'boolean',
      description: 'Use Let\'s Encrypt staging environment',
      default: false
    })
    .option('ssh-port', {
      type: 'number',
      description: 'SSH server port',
      default: 51397
    })
    .option('http-port', {
      type: 'number',
      description: 'HTTP server port',
      default: 55504
    })
    .option('https-port', {
      type: 'number',
      description: 'HTTPS server port',
      default: 443
    })
    .help()
    .argv;

  const server = new TunnelServer({
    ssl: argv.ssl,
    email: argv.email,
    staging: argv.staging,
    sshPort: argv.sshPort,
    httpPort: argv.httpPort,
    httpsPort: argv.httpsPort
  });

  server.start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}