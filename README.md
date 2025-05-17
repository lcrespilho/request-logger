# Request Logger

A simple HTTP request logging service that captures and displays incoming HTTP requests in real-time. Perfect for debugging webhooks, HTTP clients, and API integrations.

## Features

- Logs all incoming HTTP requests
- Real-time updates via WebSocket
- Web interface to view logged requests
- Supports all HTTP methods
- CORS enabled
- Request body and headers capture

## Installation

```bash
# Clone the repository
git clone [repo-url]

# Install dependencies
npm install

# Start the server
npm start
```

## Usage

The server runs on port 1029 by default. You can change this by setting the PORT environment variable.

### Endpoints

#### Request Logging

`http://localhost:1029/collect/*` : Any HTTP method will be logged

#### Web Interface

`http://localhost:1029/logs` : Main web interface to view logged requests

## NGINX domain-mapping with proxy_pass

Use this server block map this service on your own domain, under the /request-logger path:

```nginx
location /request-logger/ {
  proxy_pass http://127.0.0.1:1029/;
  proxy_set_header Host $http_host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_http_version 1.1;
  proxy_set_header Connection '';
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 86400s;
  proxy_send_timeout 86400s;
}
```

### Domain-mapped endpoints

#### Request Logging

`https://your-domain.com/request-logger/collect/*` : Any HTTP method will be logged

#### Web Interface

`https://your-domain.com/request-logger/logs` : Main web interface to view logged requests

## Managing the process via PM2

```bash
cd request-logger
pm2 start "npm start" --name request-logger
pm2 save
```
