const net = require('net');
const ssh2 = require('ssh2').Client;
const fs = require('fs');
const path = require('path');
const debug = require('debug')('porcupine:client');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

class TunnelClient {
  constructor(options) {
    this.options = options;
    this.ssh = new ssh2();
    this.connected = false;
    this.retryCount = 0;
    this.maxRetries = options.maxRetries || 5;
    this.retryDelay = options.retryDelay || 5000;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      debug('Connecting to SSH server...');

      const onError = (err) => {
        debug('SSH connection error:', err);
        this.ssh.removeListener('ready', onReady);
        reject(err);
      };

      const onReady = () => {
        debug('SSH connection established');
        this.ssh.removeListener('error', onError);
        this.connected = true;
        resolve();
      };

      this.ssh.once('error', onError);
      this.ssh.once('ready', onReady);

      this.ssh.connect({
        host: this.options.remoteHost,
        port: this.options.remotePort,
        username: this.options.username || 'tunnel',
        privateKey: this.options.privateKey,
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
      });
    });
  }

  async createTunnel() {
    if (!this.connected) {
      throw new Error('Not connected to SSH server');
    }

    return new Promise((resolve, reject) => {
      this.ssh.forwardIn(this.options.hostname, this.options.localPort, (err, port) => {
        if (err) {
          debug('Port forwarding error:', err);
          return reject(err);
        }

        debug(`Port forwarding established: ${this.options.hostname}:${this.options.localPort} -> localhost:${this.options.localPort}`);
        
        // Handle incoming connections
        this.ssh.on('tcp connection', (info, accept, reject) => {
          debug('New connection:', info);
          
          const stream = accept();
          const socket = net.connect(this.options.localPort, 'localhost');

          stream.on('error', (err) => {
            debug('Stream error:', err);
            socket.destroy();
          });

          socket.on('error', (err) => {
            debug('Socket error:', err);
            stream.end();
          });

          stream.pipe(socket).pipe(stream);
        });

        resolve(port);
      });
    });
  }

  async start() {
    try {
      await this.connect();
      await this.createTunnel();
      
      console.log(`Tunnel established: ${this.options.hostname} -> localhost:${this.options.localPort}`);
      console.log('Your site is now accessible at:');
      console.log(`http://${this.options.hostname}`);
      
      // Handle reconnection
      this.ssh.on('error', async (err) => {
        debug('SSH error:', err);
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`Connection lost. Retrying in ${this.retryDelay/1000} seconds... (${this.retryCount}/${this.maxRetries})`);
          setTimeout(() => this.start(), this.retryDelay);
        } else {
          console.error('Max retries reached. Exiting...');
          process.exit(1);
        }
      });

    } catch (err) {
      console.error('Failed to establish tunnel:', err);
      process.exit(1);
    }
  }
}

function generateSubdomain(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

if (require.main === module) {
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('host', {
      alias: 'h',
      description: 'Remote SSH server host',
      default: 'localhost'
    })
    .option('port', {
      alias: 'p',
      description: 'Remote SSH server port',
      default: 2222
    })
    .option('local-port', {
      alias: 'l',
      description: 'Local port to tunnel',
      demandOption: true
    })
    .option('hostname', {
      alias: 'n',
      description: 'Hostname for the tunnel',
      demandOption: true
    })
    .option('key', {
      alias: 'k',
      description: 'Path to private key file',
      default: path.join(process.env.HOME || process.env.USERPROFILE, '.ssh', 'id_rsa')
    })
    .help()
    .argv;

  let privateKey;
  try {
    privateKey = fs.readFileSync(argv.key);
  } catch (err) {
    console.error('Failed to read private key:', err);
    process.exit(1);
  }

  const client = new TunnelClient({
    remoteHost: argv.host,
    remotePort: argv.port,
    localPort: argv.localPort,
    hostname: argv.hostname,
    privateKey: privateKey
  });

  client.start();
}