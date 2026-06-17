import { ClipboardHub } from '../websocket/hub';
import WebSocket from 'ws';
import http from 'http';

jest.mock('../services/redis', () => ({
  redisService: {
    subscribe: jest.fn(),
    publish: jest.fn(),
    setClipboard: jest.fn(),
    getClipboard: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../services/db', () => ({
  dbService: {
    registerDevice: jest.fn().mockResolvedValue({ id: 'device-123' }),
    getDevices: jest.fn().mockResolvedValue([]),
  },
}));

describe('ClipboardHub', () => {
  let hub: ClipboardHub;

  beforeEach(() => {
    jest.clearAllMocks();
    hub = new ClipboardHub();
  });

  it('should reject connection if token is missing', async () => {
    const ws = {
      close: jest.fn(),
      send: jest.fn(),
      on: jest.fn(),
    } as unknown as WebSocket;

    const req = {
      url: '/sync?deviceName=MyLaptop&osType=windows',
    } as unknown as http.IncomingMessage;

    await hub.handleConnection(ws, req);

    expect(ws.close).toHaveBeenCalledWith(4001, expect.stringContaining('Missing token'));
  });

  it('should reject connection if token is invalid (empty)', async () => {
    const ws = {
      close: jest.fn(),
      send: jest.fn(),
      on: jest.fn(),
    } as unknown as WebSocket;

    const req = {
      url: '/sync?token=&deviceName=MyLaptop&osType=windows',
    } as unknown as http.IncomingMessage;

    await hub.handleConnection(ws, req);

    expect(ws.close).toHaveBeenCalledWith(4001, expect.stringContaining('Missing token'));
  });

  it('should accept connection, verify token, and register message handlers', async () => {
    const ws = {
      close: jest.fn(),
      send: jest.fn(),
      on: jest.fn(),
    } as unknown as WebSocket;

    const req = {
      url: '/sync?token=mock-token-user123&deviceName=MyLaptop&osType=windows',
    } as unknown as http.IncomingMessage;

    await hub.handleConnection(ws, req);

    expect(ws.close).not.toHaveBeenCalled();
    expect(ws.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(ws.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(ws.on).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
