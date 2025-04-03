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
__http://localhost:1029/collect/*__ : Any HTTP method will be logged

#### Web Interface
__http://localhost:1029/logs__ : Main web interface to view logged requests


## NGINX domain-mapping with proxy_pass
Use this server block map this service on your own domain, under the /request-logger path:

```nginx
location /request-logger/ {
  proxy_pass http://127.0.0.1:1029/;
  proxy_set_header Host $http_host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Own domain Endpoints

#### Request Logging
__https://your-domain.com/request-logger/collect/*__ : Any HTTP method will be logged

#### Web Interface
__https://your-domain.com/request-logger/logs__ : Main web interface to view logged requests