import { Request, Response } from 'express';
import { supabase } from '../../../db/config/supabase';
import { Agent, AuthenticatedRequest } from '../../../shared/types';

/**
 * Get all public agents with pagination
 */
export const getAllAgents = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Query agents with pagination - Use explicit join instead of relation
    const { data: agents, error, count } = await supabase
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
    const { data: agent, error } = await supabase
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
      const { data: likeData, error: likeError } = await supabase
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
    incrementViewCount(id).catch(err => {
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
export const createAgent = async (req: Request, res: Response) => {
  // ...existing code...
};

/**
 * Update an agent
 */
export const updateAgent = async (req: Request, res: Response) => {
  // ...existing code...
};

/**
 * Delete an agent
 */
export const deleteAgent = async (req: Request, res: Response) => {
  // ...existing code...
};

/**
 * Like an agent
 */
export const likeAgent = async (req: Request, res: Response) => {
  // ...existing code...
};

/**
 * Record a view for an agent
 */
export const viewAgent = async (req: Request, res: Response) => {
  // ...existing code...
};

/**
 * Search for agents
 */
export const searchAgents = async (req: Request, res: Response) => {
  // ...existing code...
};

/**
 * Get featured agents
 */
export const getFeaturedAgents = async (req: Request, res: Response) => {
  // ...existing code...
};

/**
 * Get trending agents
 */
export const getTrendingAgents = async (req: Request, res: Response) => {
  // ...existing code...
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
 */
async function incrementViewCount(agentId: string): Promise<void> {
  try {
    // Call the Supabase function to increment views
    await supabase.rpc('increment_agent_views', { agent_id: agentId });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    throw error;
  }
}