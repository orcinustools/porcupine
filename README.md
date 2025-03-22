# 🦔 Porcupine

An open-source alternative to ngrok/serveo that allows you to expose your local web services to the internet through SSH tunneling.

## Features

- 🔒 Secure SSH tunneling
- 🌐 Custom domain support
- 🔑 Public key authentication
- 🚀 Easy to use CLI
- 📝 Detailed logging
- 🔄 Auto-reconnect support

## Prerequisites

- Node.js v14 or higher
- OpenSSH client (for key generation)

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

```bash
npm run start:server
```

This will start the Porcupine server with:
- SSH server on port 2222
- HTTP proxy on port 80

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

Your local server will be accessible at `http://myapp.localhost:80`

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
┌─────────────┐     SSH     ┌──────────────┐    HTTP    ┌──────────┐
│   Client    ├────tunnel───►   Porcupine  ◄────proxy───┤ Internet │
│ (Your App)  │             │    Server    │            │          │
└─────────────┘             └──────────────┘            └──────────┘
```

- **Client**: Connects to your local service and establishes SSH tunnel
- **Server**: Handles SSH connections and proxies HTTP requests
- **Tunnel**: Secure SSH tunnel for forwarding traffic

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

## To Do
[ ] Support secure connection
[ ] Bash script client