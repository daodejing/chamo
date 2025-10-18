/**
 * Development-only WebSocket proxy for Supabase Realtime
 * Converts query parameters to headers before Kong sees the request
 *
 * Why: Kong's request-transformer can only access headers, not query params.
 * WebSocket authentication requires apikey in query params, causing Kong to reject with 403.
 *
 * Usage: Started automatically via `pnpm dev`
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const http = require('http');
const httpProxyLib = require('http-proxy');
const url = require('url');

// Only run in development
if (process.env.NODE_ENV === 'production') {
  console.log('Realtime proxy skipped (production mode)');
  process.exit(0);
}

// Configuration from environment variables - fail fast if not set
if (!process.env.REALTIME_PROXY_PORT) {
  console.error('ERROR: REALTIME_PROXY_PORT environment variable is not set');
  console.error('Please set it in your .env.local file');
  process.exit(1);
}

if (!process.env.REALTIME_PROXY_KONG_TARGET) {
  console.error('ERROR: REALTIME_PROXY_KONG_TARGET environment variable is not set');
  console.error('Please set it in your .env.local file');
  process.exit(1);
}

if (!process.env.REALTIME_PROXY_DIRECT_TARGET) {
  console.error('ERROR: REALTIME_PROXY_DIRECT_TARGET environment variable is not set');
  console.error('Please set it in your .env.local file');
  process.exit(1);
}

const PROXY_PORT = parseInt(process.env.REALTIME_PROXY_PORT, 10);
const KONG_TARGET = process.env.REALTIME_PROXY_KONG_TARGET;
const REALTIME_TARGET = process.env.REALTIME_PROXY_DIRECT_TARGET;

// Validate port is a valid number
if (isNaN(PROXY_PORT) || PROXY_PORT < 1 || PROXY_PORT > 65535) {
  console.error(`ERROR: Invalid REALTIME_PROXY_PORT: ${process.env.REALTIME_PROXY_PORT}`);
  console.error('Port must be a number between 1 and 65535');
  process.exit(1);
}

// Validate target URL formats
try {
  new URL(KONG_TARGET);
} catch (err) {
  console.error(`ERROR: Invalid REALTIME_PROXY_KONG_TARGET URL: ${KONG_TARGET}`);
  console.error('Must be a valid URL (e.g., http://localhost:54321)');
  process.exit(1);
}

try {
  new URL(REALTIME_TARGET);
} catch (err) {
  console.error(`ERROR: Invalid REALTIME_PROXY_DIRECT_TARGET URL: ${REALTIME_TARGET}`);
  console.error('Must be a valid URL (e.g., ws://localhost:4000)');
  process.exit(1);
}

// Create proxy servers
// HTTP/REST proxy -> Kong
const httpProxy = httpProxyLib.createProxyServer({
  target: KONG_TARGET,
  changeOrigin: true,
});

// WebSocket proxy -> Realtime (bypasses Kong)
const wsProxy = httpProxyLib.createProxyServer({
  target: REALTIME_TARGET,
  ws: true,
  changeOrigin: true,
});

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);

  // Extract apikey from query params and add as header
  const parsedUrl = url.parse(req.url, true);
  if (parsedUrl.query.apikey) {
    console.log(`[HTTP] Adding apikey header from query param`);
    req.headers['apikey'] = parsedUrl.query.apikey;
  }

  // Proxy HTTP request to Kong
  httpProxy.web(req, res);
});

// Handle WebSocket upgrade requests
server.on('upgrade', (req, socket, head) => {
  console.log(`[WebSocket] Upgrade request: ${req.url}`);
  console.log(`[WebSocket] Cookie header:`, req.headers.cookie?.substring(0, 100) + '...');

  // Extract apikey from query params and add as headers
  const parsedUrl = url.parse(req.url, true);
  if (parsedUrl.query.apikey) {
    console.log(`[WebSocket] Query apikey: ${parsedUrl.query.apikey.substring(0, 20)}...`);

    // Check if there's a JWT token in cookies (for authenticated users)
    const cookies = req.headers.cookie;
    let authToken = parsedUrl.query.apikey; // Default to anon key

    if (cookies) {
      // Try to extract Supabase auth token from cookies
      const tokenMatch = cookies.match(/sb-[^-]+-auth-token=([^;]+)/);
      if (tokenMatch) {
        try {
          const tokenData = JSON.parse(decodeURIComponent(tokenMatch[1]));
          if (tokenData && tokenData.access_token) {
            authToken = tokenData.access_token;
            console.log(`[WebSocket] Using JWT from cookie: ${authToken.substring(0, 20)}...`);
          }
        } catch (e) {
          console.log(`[WebSocket] Could not parse auth cookie, using apikey`);
        }
      }
    }

    // Add as apikey header (for Kong's request-transformer)
    req.headers['apikey'] = parsedUrl.query.apikey;
    // Add Authorization with actual JWT token (for authenticated users)
    req.headers['authorization'] = `Bearer ${authToken}`;
  } else {
    console.log(`[WebSocket] WARNING: No apikey found in query params`);
  }

  console.log(`[WebSocket] Headers:`, Object.keys(req.headers));
  console.log(`[WebSocket] BYPASSING Kong - Forwarding directly to ${REALTIME_TARGET}`);

  // Proxy WebSocket upgrade directly to Realtime (bypass Kong)
  wsProxy.ws(req, socket, head);
});

// Error handling
httpProxy.on('error', (err, req, res) => {
  console.error('[HTTP] Proxy error:', err.message);
  if (res && !res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('HTTP Proxy error');
  }
});

wsProxy.on('error', (err, req, socket) => {
  console.error('[WebSocket] Proxy error:', err.message);
  if (socket && !socket.destroyed) {
    socket.end();
  }
});

// Start server
server.listen(PROXY_PORT, () => {
  console.log(`🔌 Realtime proxy running`);
  console.log(`   REALTIME_PROXY_PORT: ${PROXY_PORT}`);
  console.log(`   REALTIME_PROXY_KONG_TARGET: ${KONG_TARGET}`);
  console.log(`   REALTIME_PROXY_DIRECT_TARGET: ${REALTIME_TARGET}`);
  console.log(`   Listening on: http://localhost:${PROXY_PORT}`);
  console.log(`   HTTP/REST → ${KONG_TARGET}`);
  console.log(`   WebSocket → ${REALTIME_TARGET} (BYPASS Kong)`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Realtime proxy...');
  server.close(() => {
    httpProxy.close();
    wsProxy.close();
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    httpProxy.close();
    wsProxy.close();
    process.exit(0);
  });
});
