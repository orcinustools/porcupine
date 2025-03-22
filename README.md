# 🦔 Porcupine

An open-source alternative to ngrok/serveo that allows you to expose your local web services to the internet through SSH tunneling.

## Features

- 🔒 Secure SSH tunneling
- 🌐 Custom domain support
- 🔑 Public key authentication
- 🚀 Easy to use CLI
- 📝 Detailed logging
- 🔄 Auto-reconnect support
- 🔐 Automatic SSL/HTTPS with Let's Encrypt
- 🌍 Multiple domain support
- ♾️ Unlimited tunnels

## Prerequisites

- Node.js v14 or higher
- OpenSSH client (for key generation)
- Root/sudo access (for SSL on port 443)

## Installation

```bash
# Clone the repository
git clone https://github.com/anak10thn/porcupine.git
cd porcupine

# Install dependencies
npm install

# Generate SSH host keys
npm run generate-keys
```

## Usage

### Starting the Server

#### Basic HTTP Server
```bash
npm run start:server
```

This will start the Porcupine server with:
- SSH server on port 51397
- HTTP proxy on port 55504

#### HTTPS Server with SSL
```bash
sudo npm run start:server -- --ssl --email your@email.com
```

This will start the server with:
- SSH server on port 51397
- HTTP proxy on port 55504
- HTTPS proxy on port 443
- Automatic SSL certificates from Let's Encrypt

#### Server Options
```
Options:
  --ssl          Enable SSL/HTTPS support                    [boolean] [default: false]
  --email        Email for Let's Encrypt registration        [string] [default: "anak10thn@gmail.com"]
  --staging      Use Let's Encrypt staging environment       [boolean] [default: false]
  --ssh-port     SSH server port                            [number] [default: 51397]
  --http-port    HTTP server port                           [number] [default: 55504]
  --https-port   HTTPS server port                          [number] [default: 443]
  --help         Show help                                  [boolean]
```

### Starting the Client

First, make sure you have an SSH key pair. If not, generate one:

```bash
ssh-keygen -t rsa -b 4096
```

Add your public key to the server's authorized_keys:

```bash
cat ~/.ssh/id_rsa.pub >> keys/authorized_keys
```

Then start the client:

```bash
npm run start:client -- \
  --host your-server.com \
  --port 51397 \
  --local-port 8080 \
  --hostname myapp.example.com
```

Options:
- `--host`: Porcupine server hostname (default: localhost)
- `--port`: Porcupine SSH server port (default: 51397)
- `--local-port`: Your local service port (required)
- `--hostname`: Public hostname for your service (required)
- `--key`: Path to your SSH private key (default: ~/.ssh/id_rsa)

### Example

1. Start a local web server:
```bash
python3 -m http.server 8080
```

2. Start the Porcupine client:
```bash
npm run start:client -- \
  --local-port 8080 \
  --hostname myapp.localhost
```

Your local server will be accessible at:
- `http://myapp.localhost:55504`
- `https://myapp.localhost` (if SSL enabled)

## Development

### Running Tests

```bash
npm test
```

### Debug Logging

To enable debug logs:

```bash
DEBUG=porcupine:* npm run start:server
DEBUG=porcupine:* npm run start:client -- [options]
```

## Architecture

```
┌─────────────┐     SSH     ┌──────────────┐    HTTP(S)   ┌──────────┐
│   Client    ├────tunnel───►   Porcupine  ◄────proxy─────┤ Internet │
│ (Your App)  │             │    Server    │              │          │
└─────────────┘             └──────────────┘              └──────────┘
                                  │
                                  ▼
                           Let's Encrypt
                          (SSL Certificates)
```

Components:
- **Client**: Connects to your local service and establishes SSH tunnel
- **Server**: Handles SSH connections and proxies HTTP/HTTPS requests
- **Tunnel**: Secure SSH tunnel for forwarding traffic
- **SSL**: Automatic certificate management with Let's Encrypt

## Security Considerations

1. **SSH Security**:
   - Use strong SSH keys (RSA 4096-bit minimum)
   - Keep private keys secure
   - Regularly rotate SSH keys

2. **SSL Security**:
   - Certificates are automatically renewed
   - Private keys are stored securely
   - SNI for multiple domain support

3. **Access Control**:
   - Only authorized SSH keys can create tunnels
   - Each tunnel is isolated
   - Rate limiting on certificate requests

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**anak10thn** (anak10thn@gmail.com)

## SSL/HTTPS Support

Porcupine supports automatic SSL certificate management using Let's Encrypt:

### Features
- 🔐 Automatic certificate generation
- 🔄 Automatic certificate renewal
- 📝 SNI support for multiple domains
- ⚡ Zero-configuration SSL
- 🏗️ Staging environment support

### Requirements for SSL
1. Domain must point to your server
2. Root/sudo access (for port 443)
3. Valid email address for Let's Encrypt notifications
4. Server must be accessible from the internet

### SSL Setup Example

1. Point your domain to the server:
```
myapp.example.com -> YOUR_SERVER_IP
```

2. Start the server with SSL:
```bash
sudo npm run start:server -- \
  --ssl \
  --email your@email.com \
  --https-port 443
```

3. Start the client:
```bash
npm run start:client -- \
  --host your-server.com \
  --local-port 8080 \
  --hostname myapp.example.com
```

Your local service will be accessible at:
- `http://myapp.example.com`
- `https://myapp.example.com` (SSL enabled)

### SSL Testing

For testing, use the `--staging` flag to avoid Let's Encrypt rate limits:

```bash
sudo npm run start:server -- \
  --ssl \
  --email your@email.com \
  --staging
```

## Examples

### Basic Local Web Server
```bash
# Terminal 1: Start a test web server
python3 -m http.server 8080

# Terminal 2: Start Porcupine server
npm run start:server

# Terminal 3: Start Porcupine client
npm run start:client -- \
  --local-port 8080 \
  --hostname myapp.localhost
```

### Production HTTPS Setup
```bash
# Terminal 1: Start your Node.js app
node app.js

# Terminal 2: Start Porcupine server with SSL
sudo npm run start:server -- \
  --ssl \
  --email your@email.com

# Terminal 3: Start Porcupine client
npm run start:client -- \
  --host your-server.com \
  --local-port 3000 \
  --hostname api.example.com
```