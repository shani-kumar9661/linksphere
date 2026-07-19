const AppError = require('../../src/utils/AppError');

describe('AppError unit tests', () => {
  test('should create an error with message and statusCode', () => {
    const error = new AppError('Resource not found', 404);
    expect(error.message).toBe('Resource not found');
    expect(error.statusCode).toBe(404);
  });

  test('should set status to fail for 4xx status codes', () => {
    const error = new AppError('Bad Request', 400);
    expect(error.status).toBe('fail');
    const unauthorizedError = new AppError('Unauthorized', 401);
    expect(unauthorizedError.status).toBe('fail');
  });

  test('should set status to error for 5xx status codes', () => {
    const error = new AppError('Internal Server Error', 500);
    expect(error.status).toBe('error');
    const badGatewayError = new AppError('Bad Gateway', 502);
    expect(badGatewayError.status).toBe('error');
  });

  test('should set isOperational to true', () => {
    const error = new AppError('Some failure', 400);
    expect(error.isOperational).toBe(true);
  });

  test('should capture stack trace', () => {
    const error = new AppError('Stack error', 500);
    expect(error.stack).toBeDefined();
  });
});
