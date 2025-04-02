import { Request, Response } from 'express';
import { supabase } from '../../../db/config/supabase';

/**
 * Register a new user
 */
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'missing_fields',
          message: 'Email, password, and name are required'
        }
      });
    }

    // Register user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'registration_failed',
          message: authError.message
        }
      });
    }

    // Create user profile in users table
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          name: name,
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Don't return error to client as auth was successful
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to confirm your account.'
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Login user
 */
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'missing_fields',
          message: 'Email and password are required'
        }
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'invalid_credentials',
          message: 'Invalid email or password'
        }
      });
    }

    return res.status(200).json({
      success: true,
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Logout user
 */
export const logoutUser = async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'logout_failed',
          message: error.message
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'missing_refresh_token',
          message: 'Refresh token is required'
        }
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'invalid_refresh_token',
          message: 'Invalid or expired refresh token'
        }
      });
    }

    return res.status(200).json({
      success: true,
      session: data.session
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Get current user profile
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // User is already authenticated via middleware
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'Not authenticated'
        }
      });
    }

    // Get user profile from database - Remove single() to handle missing profiles
    const { data: profiles, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId);

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'profile_error',
          message: 'Error retrieving user profile'
        }
      });
    }

    // If no profile found, create a basic one from auth data
    if (!profiles || profiles.length === 0) {
      // Get email from auth user
      const { data: authUser } = await supabase.auth.getUser();
      
      // Create a new profile
      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: authUser?.user?.email || 'user@example.com',
          name: authUser?.user?.email?.split('@')[0] || 'User'
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating user profile:', insertError);
        return res.status(200).json({
          success: true,
          user: {
            id: userId,
            email: authUser?.user?.email || 'user@example.com',
            name: authUser?.user?.email?.split('@')[0] || 'User',
            createdAt: new Date().toISOString()
          }
        });
      }
      
      return res.status(200).json({
        success: true,
        user: {
          id: newProfile.id,
          email: newProfile.email,
          name: newProfile.name,
          avatar: newProfile.avatar_url,
          createdAt: newProfile.created_at
        }
      });
    }

    const profile = profiles[0];
    
    return res.status(200).json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar_url,
        createdAt: profile.created_at
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};