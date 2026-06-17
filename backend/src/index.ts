import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import { config } from './config';
import { clipboardHub } from './websocket/hub';
import { authMiddleware, AuthenticatedRequest } from './middleware/auth';
import { redisService } from './services/redis';

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    redis: redisService.client ? 'connected' : 'disconnected'
  });
});

// Authenticated route to get current clipboard contents (HTTP GET fallback)
app.get('/api/clipboard', authMiddleware as express.RequestHandler, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  try {
    const content = await redisService.getClipboard(userId);
    res.json({ content: content || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated route to update clipboard contents (HTTP POST fallback)
app.post('/api/clipboard', authMiddleware as express.RequestHandler, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const { content } = req.body;
  
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  if (content === undefined) {
    res.status(400).json({ error: 'Missing content in request body' });
    return;
  }
  
  try {
    await redisService.setClipboard(userId, content);
    // Publish update to other clients via Redis pub/sub
    await redisService.publish('clipboard_channel', JSON.stringify({
      userId,
      senderDeviceId: 'api-http-request',
      content
    }));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const server = http.createServer(app);

// Create WebSocket server without mounting it to a specific path initially
const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket connection upgrade requests
server.on('upgrade', (request, socket, head) => {
  try {
    const reqUrl = request.url || '';
    const parsedUrl = new URL(reqUrl, 'http://localhost');
    const pathname = parsedUrl.pathname;

    if (pathname === '/sync') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  } catch (err) {
    console.error('WebSocket upgrade error:', err);
    socket.destroy();
  }
});

// Route WebSocket connection event to ClipboardHub handler
wss.on('connection', (ws, request) => {
  clipboardHub.handleConnection(ws, request);
});

server.listen(config.port, () => {
  console.log(`Clp Sync Server listening on port ${config.port}`);
});
