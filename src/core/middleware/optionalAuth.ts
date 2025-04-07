import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../db/config/supabase';
import { AuthenticatedRequest } from '../../shared/types';

/**
 * Middleware to optionally authenticate users
 * Similar to authenticateUser but doesn't return an error if no token is provided
 */
export const optionalAuthUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the JWT token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Verify the token with Supabase
      const { data, error } = await supabase.auth.getUser(token);
      
      if (!error && data.user) {
        // Add the user to the request object
        (req as AuthenticatedRequest).user = data.user;
      }
    }
    
    // Continue to the next middleware/controller regardless of auth status
    next();
  } catch (error) {
    console.error('Error in optional authentication:', error);
    // Continue to the next middleware/controller even if auth fails
    next();
  }
};
