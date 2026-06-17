import Redis from 'ioredis';
import { config } from '../config';

class RedisService {
  public client: Redis | null = null;
  public publisher: Redis | null = null;
  public subscriber: Redis | null = null;

  constructor() {
    if (config.redisUrl) {
      try {
        const options = {
          maxRetriesPerRequest: null,
          retryStrategy(times: number) {
            const delay = Math.min(times * 50, 2000);
            return delay;
          }
        };

        this.client = new Redis(config.redisUrl, options);
        this.publisher = new Redis(config.redisUrl, options);
        this.subscriber = new Redis(config.redisUrl, options);

        this.client.on('connect', () => console.log('Redis client connected.'));
        this.publisher.on('connect', () => console.log('Redis publisher connected.'));
        this.subscriber.on('connect', () => console.log('Redis subscriber connected.'));

        this.client.on('error', (err) => console.error('Redis Client Error:', err));
        this.publisher.on('error', (err) => console.error('Redis Publisher Error:', err));
        this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
      } catch (err) {
        console.error('Failed to initialize Redis:', err);
      }
    }
  }

  async setClipboard(userId: string, data: string, ttlSeconds: number = 300): Promise<void> {
    if (!this.client) {
      console.warn('Redis client not initialized');
      return;
    }
    await this.client.set(`clipboard:${userId}`, data, 'EX', ttlSeconds);
  }

  async getClipboard(userId: string): Promise<string | null> {
    if (!this.client) {
      console.warn('Redis client not initialized');
      return null;
    }
    return this.client.get(`clipboard:${userId}`);
  }

  async publish(channel: string, message: string): Promise<void> {
    if (!this.publisher) return;
    await this.publisher.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.subscriber) return;
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (chan, msg) => {
      if (chan === channel) {
        callback(msg);
      }
    });
  }
}

export const redisService = new RedisService();
export default RedisService;
