const Greenlock = require('greenlock');
const path = require('path');
const debug = require('debug')('porcupine:ssl');

class SSLManager {
  constructor(options = {}) {
    this.options = options;
    this.greenlock = null;
    this.certsDir = path.join(__dirname, '..', 'certs');
  }

  async init() {
    debug('Initializing SSL manager');
    
    this.greenlock = Greenlock.create({
      packageRoot: path.join(__dirname, '..'),
      configDir: this.certsDir,
      maintainerEmail: this.options.email || 'anak10thn@gmail.com',
      notify: (event, details) => {
        if (event === 'error') {
          debug('SSL Error:', details);
        }
      }
    });

    await this.greenlock.manager.defaults({
      agreeToTerms: true,
      subscriberEmail: this.options.email || 'anak10thn@gmail.com',
      staging: this.options.staging || false
    });

    debug('SSL manager initialized');
    return this;
  }

  async getCertificate(domain) {
    debug(`Getting certificate for ${domain}`);
    
    try {
      const results = await this.greenlock.add({
        subject: domain,
        altnames: [domain]
      });

      if (!results.pems) {
        throw new Error('Failed to obtain SSL certificate');
      }

      debug(`Certificate obtained for ${domain}`);
      return {
        key: results.pems.privkey,
        cert: results.pems.cert + '\n' + results.pems.chain
      };
    } catch (err) {
      debug(`Error getting certificate: ${err.message}`);
      throw err;
    }
  }

  async renewCertificates() {
    debug('Checking for certificates to renew');
    try {
      await this.greenlock.manager.renewAll();
      debug('Certificate renewal check completed');
    } catch (err) {
      debug(`Error renewing certificates: ${err.message}`);
    }
  }
}

module.exports = SSLManager;