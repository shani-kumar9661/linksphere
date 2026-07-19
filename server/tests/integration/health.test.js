const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { redisClient } = require('../../src/config/redis');

// Mock mongoose and redisClient
jest.mock('mongoose', () => {
  const original = jest.requireActual('mongoose');
  return {
    ...original,
    connection: {
      readyState: 1, // 1 = connected
      on: jest.fn(),
    }
  };
});

jest.mock('../../src/config/redis', () => {
  return {
    redisClient: {
      isOpen: true,
      ping: jest.fn().mockResolvedValue('PONG'),
      on: jest.fn(),
      sendCommand: jest.fn().mockImplementation((commandArgs) => {
        const cmd = commandArgs && commandArgs[0] ? commandArgs[0].toString().toLowerCase() : '';
        const sub = commandArgs && commandArgs[1] ? commandArgs[1].toString().toLowerCase() : '';
        if (cmd === 'script' && sub === 'load') {
          return Promise.resolve('mock-sha-hash');
        }
        return Promise.resolve([1, 15000]);
      })
    },
    connectRedis: jest.fn().mockResolvedValue(true)
  };
});

describe('GET /health integration tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return 200 health check success when DB and Redis are connected', async () => {
    mongoose.connection.readyState = 1;
    redisClient.isOpen = true;
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.database).toBe('connected');
    expect(response.body.redis).toBe('connected');
    expect(response.body.uptime).toBeDefined();
  });

  test('should return 503 unhealthy when database is disconnected', async () => {
    mongoose.connection.readyState = 0; // 0 = disconnected
    redisClient.isOpen = true;
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app)
      .get('/health')
      .expect(503);

    expect(response.body.status).toBe('unhealthy');
    expect(response.body.database).toBe('disconnected');
    expect(response.body.redis).toBe('connected');
  });

  test('should return 503 unhealthy when redis is disconnected', async () => {
    mongoose.connection.readyState = 1;
    redisClient.isOpen = false;

    const response = await request(app)
      .get('/health')
      .expect(503);

    expect(response.body.status).toBe('unhealthy');
    expect(response.body.database).toBe('connected');
    expect(response.body.redis).toBe('disconnected');
  });

  test('should return 503 unhealthy when redis ping throws an error', async () => {
    mongoose.connection.readyState = 1;
    redisClient.isOpen = true;
    redisClient.ping.mockRejectedValueOnce(new Error('Redis Timeout'));

    const response = await request(app)
      .get('/health')
      .expect(503);

    expect(response.body.status).toBe('unhealthy');
    expect(response.body.database).toBe('connected');
    expect(response.body.redis).toBe('error');
  });
});
