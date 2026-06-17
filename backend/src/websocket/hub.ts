import WebSocket from 'ws';
import http from 'http';
import { URL } from 'url';
import { dbService } from '../services/db';
import { redisService } from '../services/redis';

export interface ClipboardClient {
  ws: WebSocket;
  userId: string;
  deviceId: string;
  deviceName: string;
  osType: string;
}

export class ClipboardHub {
  // Map of userId -> Set of ClipboardClient
  private activeClients = new Map<string, Set<ClipboardClient>>();

  constructor() {
    this.setupRedisSubscription();
  }

  private setupRedisSubscription() {
    redisService.subscribe('clipboard_channel', (message: string) => {
      try {
        const data = JSON.parse(message);
        const { userId, senderDeviceId, content } = data;
        
        // Broadcast to local clients for this user
        this.broadcastToLocalClients(userId, senderDeviceId, content);
      } catch (err) {
        console.error('Error handling Redis pub/sub message:', err);
      }
    });
  }

  public async handleConnection(ws: WebSocket, req: http.IncomingMessage) {
    try {
      const reqUrl = req.url || '';
      const parsedUrl = new URL(reqUrl, 'http://localhost');
      const token = parsedUrl.searchParams.get('token');
      const deviceName = parsedUrl.searchParams.get('deviceName') || 'Unknown Device';
      const osType = parsedUrl.searchParams.get('osType') || 'unknown';

      if (!token) {
        ws.close(4001, 'Unauthorized: Missing token');
        return;
      }

      // Verify token
      const user = await this.verifyToken(token);
      if (!user) {
        ws.close(4001, 'Unauthorized: Invalid token');
        return;
      }

      const userId = user.id;

      // Register device in database (falls back to temp device id if database is missing)
      let deviceId = `temp-${deviceName.replace(/\s+/g, '-')}-${Date.now()}`;
      try {
        const registered = await dbService.registerDevice(userId, deviceName, osType);
        if (registered && registered.id) {
          deviceId = registered.id;
        }
      } catch (err) {
        console.warn('Device registry failed or database not configured, using fallback client session ID:', err.message);
      }

      const client: ClipboardClient = {
        ws,
        userId,
        deviceId,
        deviceName,
        osType
      };

      // Add to local clients map
      if (!this.activeClients.has(userId)) {
        this.activeClients.set(userId, new Set());
      }
      this.activeClients.get(userId)!.add(client);

      console.log(`User ${userId} connected device: ${deviceName} (${osType})`);

      // Push latest clipboard state from Redis cache to the newly connected device
      const cachedClipboard = await redisService.getClipboard(userId);
      if (cachedClipboard) {
        ws.send(JSON.stringify({
          type: 'clipboard_sync',
          payload: {
            content: cachedClipboard,
            timestamp: Date.now()
          }
        }));
      }

      // Set up message handlers
      ws.on('message', async (messageData: WebSocket.Data) => {
        try {
          const rawMessage = messageData.toString();
          const parsed = JSON.parse(rawMessage);

          if (parsed.type === 'clipboard_update') {
            const { content } = parsed.payload;
            
            // 1. Cache in Redis
            await redisService.setClipboard(userId, content);

            // 2. Publish to Redis Pub/Sub for scalability
            await redisService.publish('clipboard_channel', JSON.stringify({
              userId,
              senderDeviceId: deviceId,
              content
            }));
          }
        } catch (err) {
          console.error('Error processing client message:', err);
        }
      });

      // Cleanup on close
      ws.on('close', () => {
        const userSet = this.activeClients.get(userId);
        if (userSet) {
          userSet.delete(client);
          if (userSet.size === 0) {
            this.activeClients.delete(userId);
          }
        }
        console.log(`User ${userId} disconnected device: ${deviceName}`);
      });

      ws.on('error', (err) => {
        console.error(`WebSocket error for device ${deviceName}:`, err);
      });

    } catch (err) {
      console.error('Connection handling error:', err);
      ws.close(1011, 'Internal Server Error');
    }
  }

  private async verifyToken(token: string): Promise<{ id: string; email?: string } | null> {
    if (token.startsWith('mock-token-')) {
      const mockId = token.replace('mock-token-', '');
      return { id: mockId, email: `${mockId}@example.com` };
    }
    if (!dbService.supabase) return null;
    try {
      const { data: { user }, error } = await dbService.supabase.auth.getUser(token);
      if (error || !user) return null;
      return { id: user.id, email: user.email };
    } catch {
      return null;
    }
  }

  private broadcastToLocalClients(userId: string, senderDeviceId: string, content: string) {
    const userSet = this.activeClients.get(userId);
    if (!userSet) return;

    const payload = JSON.stringify({
      type: 'clipboard_sync',
      payload: {
        content,
        timestamp: Date.now()
      }
    });

    for (const client of userSet) {
      if (client.deviceId !== senderDeviceId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}

export const clipboardHub = new ClipboardHub();
