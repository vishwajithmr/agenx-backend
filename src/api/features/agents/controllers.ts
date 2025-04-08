import { Request, Response } from 'express';
import { supabase } from '../../../db/config/supabase';
import { Agent, AuthenticatedRequest } from '../../../shared/types';
import { createClient } from '@supabase/supabase-js';

/**
 * Helper function to get an authenticated Supabase client
 */
function getAuthenticatedClient(req: AuthenticatedRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
  
  if (req.user?.accessToken) {
    // Create a new client with the user's JWT token
    return createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${req.user.accessToken}`,
        },
      },
    });
  }
  
  // Return the regular client if no user or token
  return supabase;
}

/**
 * Get all public agents with pagination
 */
export const getAllAgents = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Use authenticated client if available
    const client = req.user?.accessToken ? 
      getAuthenticatedClient(req as AuthenticatedRequest) : 
      supabase;

    // Query agents with pagination - Use explicit join instead of relation
    const { data: agents, error, count } = await client
      .from('agents')
      .select(`
        *,
        companies:company_id(*)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching agents:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error fetching agents'
        }
      });
    }

    // Transform the data to match the expected format
    const transformedAgents = transformAgents(agents);

    return res.status(200).json({
      success: true,
      agents: transformedAgents,
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllAgents:', error);
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
 * Get agent by ID
 */
export const getAgentById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    // Use authenticated client if available
    const client = getAuthenticatedClient(req);

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'invalid_id',
          message: 'Invalid agent ID format'
        }
      });
    }

    // Query the agent with company details
    const { data: agent, error } = await client
      .from('agents')
      .select(`
        *,
        companies:company_id(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching agent:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'agent_not_found',
            message: 'Agent not found'
          }
        });
      }
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error fetching agent'
        }
      });
    }

    // If agent is not public, check if the user is the owner
    if (!agent.is_public && agent.creator_id !== userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'agent_not_found',
          message: 'Agent not found or not accessible'
        }
      });
    }

    // Check if the user has liked this agent
    let isLiked = false;
    if (userId) {
      const { data: likeData, error: likeError } = await client
        .from('agent_likes')
        .select('id')
        .eq('agent_id', id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!likeError && likeData) {
        isLiked = true;
      }
    }

    // Transform the data to match the expected format
    const transformedAgent: Agent = transformAgent(agent);
    
    // Add ownership status
    transformedAgent.isOwner = agent.creator_id === userId;
    
    // Add liked status
    transformedAgent.isLiked = isLiked;

    // Increment view count (but don't wait for it to complete)
    incrementViewCount(id, client).catch(err => {
      console.error('Error incrementing view count:', err);
    });

    return res.status(200).json({
      success: true,
      agent: transformedAgent
    });
  } catch (error) {
    console.error('Error in getAgentById:', error);
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
 * Create a new agent
 */
export const createAgent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Use authenticated client for all mutations
    const client = getAuthenticatedClient(req);
    
    // Implement your create agent logic here using the authenticated client
    // With RLS, the client will automatically include the user's ID in requests
    
    // ...existing code...
  } catch (error) {
    console.error('Error in createAgent:', error);
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
 * Update an agent
 */
export const updateAgent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Use authenticated client for all mutations
    const client = getAuthenticatedClient(req);
    
    // With RLS enabled, the update will only succeed if the user owns the agent
    
    // ...existing code...
  } catch (error) {
    console.error('Error in updateAgent:', error);
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
 * Delete an agent
 */
export const deleteAgent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Use authenticated client for all mutations
    const client = getAuthenticatedClient(req);
    
    // With RLS enabled, the delete will only succeed if the user owns the agent
    
    // ...existing code...
  } catch (error) {
    console.error('Error in deleteAgent:', error);
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
 * Like an agent
 */
export const likeAgent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to like an agent'
        }
      });
    }
    
    // Use authenticated client
    const client = getAuthenticatedClient(req);

    // Check if agent exists
    const { data: agent, error: agentError } = await client
      .from('agents')
      .select('id')
      .eq('id', id)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'agent_not_found',
          message: 'Agent not found'
        }
      });
    }

    // Check if the user has already liked this agent
    const { data: existingLike, error: likeCheckError } = await client
      .from('agent_likes')
      .select('id')
      .eq('agent_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    let liked = false;
    let likesCount = 0;

    if (existingLike) {
      // User has already liked the agent, so remove the like
      const { error: unlikeError } = await client
        .from('agent_likes')
        .delete()
        .eq('agent_id', id)
        .eq('user_id', userId);

      if (unlikeError) {
        console.error('Error unliking agent:', unlikeError);
        return res.status(500).json({
          success: false,
          error: {
            code: 'database_error',
            message: 'Error unliking agent'
          }
        });
      }
      
      liked = false;
    } else {
      // User hasn't liked the agent yet, add a like
      const { error: likeError } = await client
        .from('agent_likes')
        .insert({
          agent_id: id,
          user_id: userId
        });

      if (likeError) {
        console.error('Error liking agent:', likeError);
        return res.status(500).json({
          success: false,
          error: {
            code: 'database_error',
            message: 'Error liking agent'
          }
        });
      }
      
      liked = true;
    }

    // Get the updated likes count
    const { data: updatedAgent, error: countError } = await client
      .from('agents')
      .select('likes')
      .eq('id', id)
      .single();

    if (!countError && updatedAgent) {
      likesCount = updatedAgent.likes;
    }

    return res.status(200).json({
      success: true,
      liked,
      likesCount
    });
  } catch (error) {
    console.error('Error in likeAgent:', error);
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
 * Record a view for an agent
 */
export const viewAgent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Use authenticated client if available
    const client = req.user?.accessToken ? 
      getAuthenticatedClient(req as AuthenticatedRequest) : 
      supabase;

    // Check if agent exists
    const { data: agent, error: agentError } = await client
      .from('agents')
      .select('id, views')
      .eq('id', id)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'agent_not_found',
          message: 'Agent not found'
        }
      });
    }

    // Increment view count using the appropriate client
    await incrementViewCount(id, client);

    // Return success with updated view count (estimated since we don't wait for the update)
    return res.status(200).json({
      success: true,
      viewsCount: agent.views + 1
    });
  } catch (error) {
    console.error('Error in viewAgent:', error);
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
 * Search for agents
 * @route GET /agents/search
 */
export const searchAgents = async (req: Request, res: Response) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;
    const userId = req.user?.id;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'invalid_query',
          message: 'Search query is required'
        }
      });
    }

    const offset = (Number(page) - 1) * Number(limit);

    // Use authenticated client if available
    const client = req.user?.accessToken
      ? getAuthenticatedClient(req as AuthenticatedRequest)
      : supabase;

    // Call the search_agents RPC function
    const { data: agents, error } = await client.rpc('search_agents', {
      search_query: query.trim(),
      poffset: offset,
      plimit: Number(limit)
    });

    if (error) {
      console.error('Error searching agents:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'search_error',
          message: 'Error performing search'
        }
      });
    }

    // Transform the data
    const transformedAgents = agents.map(agent => ({
      ...transformAgent(agent),
      isLiked: userId ? false : undefined, // Placeholder for future like logic
      isOwner: agent.creator_id === userId
    }));

    return res.status(200).json({
      success: true,
      agents: transformedAgents,
      pagination: {
        total: agents.length,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(agents.length / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error in searchAgents:', error);
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
 * Get featured agents
 */
export const getFeaturedAgents = async (req: Request, res: Response) => {
  try {
    // Use authenticated client if available
    const client = req.user?.accessToken ? 
      getAuthenticatedClient(req as AuthenticatedRequest) : 
      supabase;
    
    // Implement featured agents retrieval with the appropriate client
    
    // ...existing code...
  } catch (error) {
    console.error('Error in getFeaturedAgents:', error);
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
 * Get trending agents
 */
export const getTrendingAgents = async (req: Request, res: Response) => {
  try {
    // Use authenticated client if available
    const client = req.user?.accessToken ? 
      getAuthenticatedClient(req as AuthenticatedRequest) : 
      supabase;
    
    // Implement trending agents retrieval with the appropriate client
    
    // ...existing code...
  } catch (error) {
    console.error('Error in getTrendingAgents:', error);
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
 * Helper function to transform agents from DB format to API format
 */
function transformAgents(agents: any[]): Agent[] {
  return agents.map(transformAgent);
}

/**
 * Helper function to transform a single agent from DB format to API format
 */
function transformAgent(agent: any): Agent {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    imageUrl: agent.image_url,
    isPro: agent.is_pro,
    likes: agent.likes,
    views: agent.views,
    rating: agent.rating,
    usageCount: agent.usage_count,
    capabilities: agent.capabilities,
    company: agent.companies ? {
      id: agent.companies.id,
      name: agent.companies.name,
      logoUrl: agent.companies.logo_url,
      isVerified: agent.companies.is_verified,
      isEnterprise: agent.companies.is_enterprise
    } : null,
    createdAt: agent.created_at,
    isOwner: false, // Will be set by the caller if needed
    isLiked: false, // Will be set by the caller if needed
    creator_id: agent.creator_id,
    company_id: agent.company_id,
    is_public: agent.is_public
  };
}

/**
 * Helper function to increment the view count for an agent
 * Modified to accept a client
 */
async function incrementViewCount(agentId: string, client = supabase): Promise<void> {
  try {
    // Call the Supabase function to increment views using the provided client
    await client.rpc('increment_agent_views', { agent_id: agentId });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    throw error;
  }
}