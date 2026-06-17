import { Request, Response, NextFunction } from 'express';
import { dbService } from '../services/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  // Dev fallback / Mock token for easy local testing without a live Supabase instance
  if (token.startsWith('mock-token-')) {
    const mockId = token.replace('mock-token-', '');
    req.user = {
      id: mockId,
      email: `${mockId}@example.com`,
    };
    next();
    return;
  }

  if (!dbService.supabase) {
    res.status(500).json({ error: 'Supabase client is not configured' });
    return;
  }

  try {
    const { data: { user }, error } = await dbService.supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired session token' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
    };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
}
