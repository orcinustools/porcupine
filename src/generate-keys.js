const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function generateKeyPair() {
  console.log('Generating SSH key pair...');
  
  const { execSync } = require('child_process');
  const tmpDir = path.join(__dirname, '..', 'keys', 'tmp');
  const keyFile = path.join(tmpDir, 'ssh_host_key');
  
  // Create temporary directory
  fs.mkdirSync(tmpDir, { recursive: true });
  
  // Generate SSH key pair using ssh-keygen
  execSync(`ssh-keygen -t rsa -b 4096 -f "${keyFile}" -N "" -C "porcupine-server-key"`);
  
  // Read the generated keys
  const privateKey = fs.readFileSync(`${keyFile}`, 'utf8');
  const publicKey = fs.readFileSync(`${keyFile}.pub`, 'utf8');

  const keysDir = path.join(__dirname, '..', 'keys');
  
  try {
    fs.mkdirSync(keysDir, { recursive: true });
    
    fs.writeFileSync(path.join(keysDir, 'ssh_host_key'), privateKey);
    fs.writeFileSync(path.join(keysDir, 'ssh_host_key.pub'), publicKey);
    fs.writeFileSync(path.join(keysDir, 'authorized_keys'), '');
    
    console.log('Keys generated successfully in the keys directory:');
    console.log('- ssh_host_key (private key)');
    console.log('- ssh_host_key.pub (public key)');
    console.log('- authorized_keys (empty file for client public keys)');
  } catch (err) {
    console.error('Error generating keys:', err);
    process.exit(1);
  }
}

generateKeyPair();