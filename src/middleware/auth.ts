import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  // Get the token from the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'unauthorized',
        message: 'Authentication required. Please provide a valid token.'
      }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'invalid_token',
          message: 'Invalid or expired token.'
        }
      });
    }

    // Attach the user to the request
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'auth_error',
        message: 'An error occurred during authentication.'
      }
    });
  }
};
