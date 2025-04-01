const supabase = require('../config/supabase');

/**
 * Register a new user
 */
const signup = async (req, res, next) => {
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
const login = async (req, res, next) => {
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
const logout = async (req, res, next) => {
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
const getUser = async (req, res, next) => {
  try {
    return res.status(200).json({ user: req.user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  logout,
  getUser
};
