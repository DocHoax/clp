import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { Response } from 'express';

describe('Auth Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it('should reject requests without authorization header', async () => {
    mockRequest.headers = {};
    await authMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject requests with non-bearer authorization header', async () => {
    mockRequest.headers = {
      authorization: 'Basic dGVzdDp0ZXN0',
    };
    await authMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should accept requests with dev mock token and extract user id', async () => {
    mockRequest.headers = {
      authorization: 'Bearer mock-token-user123',
    };
    await authMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);
    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user?.id).toBe('user123');
    expect(mockRequest.user?.email).toBe('user123@example.com');
    expect(nextFunction).toHaveBeenCalled();
  });
});
```
