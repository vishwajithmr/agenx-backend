import { Request, Response, NextFunction } from 'express';
import supabase from '../config/supabase';
import { AuthenticatedRequest, AuthResponse } from '../types';

/**
 * Register a new user
 */
export const signup = async (req: Request, res: Response, next: NextFunction): Promise<Response<AuthResponse> | void> => {
  try {
    const { email, password, username } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(201).json({
      message: 'User created successfully',
      user: data.user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login a user
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<Response<AuthResponse> | void> => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return res.status(401).json({ error: error.message });
    }
    
    return res.status(200).json({
      message: 'Login successful',
      session: data.session,
      user: data.user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout the current user
 */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<Response<AuthResponse> | void> => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 */
export const getUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response<AuthResponse> | void> => {
  try {
    return res.status(200).json({ message: 'User retrieved successfully', user: req.user });
  } catch (error) {
    next(error);
  }
};
