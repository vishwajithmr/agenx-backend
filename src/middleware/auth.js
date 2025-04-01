const supabase = require('../config/supabase');

/**
 * Middleware to authenticate user requests
 */
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      return res.status(401).json({ error: error.message });
    }
    
    req.user = data.user;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticate };
