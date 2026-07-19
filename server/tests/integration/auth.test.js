require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_value_for_testing_12345';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_value_for_testing_67890';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const emailUtil = require('../../src/utils/email');

jest.mock('../../src/models/User');
jest.mock('../../src/utils/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true })
}));
jest.mock('../../src/config/redis', () => ({
  redisClient: {
    isOpen: true,
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
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
}));

describe('Auth Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    test('should register a new user successfully', async () => {
      // Setup mock behavior for checking if email/username already exists
      User.findOne.mockResolvedValueOnce(null); // email search: not found
      User.findOne.mockResolvedValueOnce(null); // username search: not found

      const mockSave = jest.fn().mockResolvedValue(true);
      const mockGenerateVerificationToken = jest.fn().mockReturnValue('mocktoken');

      User.mockImplementation(() => ({
        save: mockSave,
        generateVerificationToken: mockGenerateVerificationToken,
        _id: 'mockuserid123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user'
      }));

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123!'
        })
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.user.username).toBe('testuser');
      expect(emailUtil.sendVerificationEmail).toHaveBeenCalled();
    });

    test('should fail registration with invalid input (e.g. short password)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'te',
          email: 'invalid-email',
          password: 'short'
        })
        .expect(400);

      expect(res.body.status).toBe('fail');
    });
  });
});
