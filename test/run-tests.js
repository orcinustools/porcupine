const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const TEST_HOST = 'test.localhost';
const LOCAL_PORT = 8080;
const SSH_PORT = 51397;
const HTTP_PORT = 55504;

// Utility to wait for a port to be available
function waitForPort(port, host) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const socket = require('net').connect(port, host);
      socket.on('connect', () => {
        clearInterval(interval);
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
      });
    }, 1000);
  });
}

// Utility to make HTTP request
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('Starting tests...\n');
  
  // Create test SSH key pair
  console.log('1. Generating test SSH key pair...');
  const keyPath = path.join(__dirname, '..', 'test', 'test_key');
  try {
    await fs.access(keyPath);
    console.log('Test key already exists, skipping generation');
  } catch {
    const { execSync } = require('child_process');
    execSync(`ssh-keygen -t rsa -b 4096 -f ${keyPath} -N ""`);
    console.log('Test key generated');
  }

  // Add test key to authorized_keys
  console.log('\n2. Adding test key to authorized_keys...');
  const pubKey = await fs.readFile(`${keyPath}.pub`, 'utf8');
  const authKeysPath = path.join(__dirname, '..', 'keys', 'authorized_keys');
  await fs.writeFile(authKeysPath, pubKey);
  console.log('Test key added to authorized_keys');

  // Start test web server
  console.log('\n3. Starting test web server...');
  const testServer = spawn('node', ['test/test-server.js'], {
    stdio: 'inherit'
  });
  await waitForPort(LOCAL_PORT, 'localhost');
  console.log('Test web server started');

  // Start tunnel server
  console.log('\n4. Starting tunnel server...');
  const tunnelServer = spawn('node', ['src/server.js'], {
    stdio: 'inherit',
    env: { ...process.env, DEBUG: 'porcupine:*' }
  });
  await waitForPort(SSH_PORT, 'localhost');
  console.log('Tunnel server started');

  // Start tunnel client
  console.log('\n5. Starting tunnel client...');
  const tunnelClient = spawn('node', [
    'src/client.js',
    '--host', 'localhost',
    '--port', SSH_PORT.toString(),
    '--local-port', LOCAL_PORT.toString(),
    '--hostname', TEST_HOST,
    '--key', keyPath
  ], {
    stdio: 'inherit',
    env: { ...process.env, DEBUG: 'porcupine:*' }
  });

  // Wait for everything to be ready
  console.log('\n6. Waiting for services to be ready...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Run tests
  console.log('\n7. Running HTTP tests...');
  try {
    console.log(`Testing URL: http://${TEST_HOST}:${HTTP_PORT}`);
    const response = await makeRequest(`http://${TEST_HOST}:${HTTP_PORT}`);
    if (response.statusCode === 200) {
      console.log('✅ HTTP test passed: Got 200 response');
      if (response.data.includes('Test Server Running')) {
        console.log('✅ Content test passed: Found expected content');
      } else {
        console.log('❌ Content test failed: Content mismatch');
      }
    } else {
      console.log(`❌ HTTP test failed: Got ${response.statusCode} response`);
    }
  } catch (err) {
    console.log('❌ HTTP test failed:', err.message);
  }

  // Cleanup
  console.log('\n8. Cleaning up...');
  testServer.kill();
  tunnelServer.kill();
  tunnelClient.kill();
  
  console.log('\nTests completed!');
  process.exit(0);
}

// Run tests
runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});