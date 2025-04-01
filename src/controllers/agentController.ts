import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { Agent, DbAgent, DbCompany } from '../types';

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
export const getAgentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Use explicit join instead of relation
    const { data: agent, error } = await supabase
      .from('agents')
      .select(`
        *,
        companies:company_id(*)
      `)
      .eq('id', id)
      .single();

    if (error || !agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Agent not found'
        }
      });
    }

    // Check if private agent is accessible by user
    if (!agent.is_public && agent.creator_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'access_denied',
          message: 'You do not have permission to view this agent'
        }
      });
    }

    // Transform the data to match the expected format
    const transformedAgent = transformAgent(agent);

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
  try {
    const { name, description, imageUrl, companyId, capabilities, isPublic = true } = req.body;
    const userId = req.user?.id;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'missing_name',
          message: 'Agent name is required'
        }
      });
    }

    // If companyId is provided, check if user has access to it
    if (companyId) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, creator_id')
        .eq('id', companyId)
        .single();

      if (companyError || !company) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'invalid_company',
            message: 'Company not found'
          }
        });
      }

      if (company.creator_id !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'company_access_denied',
            message: 'You do not have permission to create agents for this company'
          }
        });
      }
    }

    // Create the agent
    const { data: newAgent, error } = await supabase
      .from('agents')
      .insert({
        name,
        description,
        image_url: imageUrl,
        company_id: companyId,
        capabilities,
        is_public: isPublic,
        creator_id: userId
      })
      .select(`
        *,
        companies:company_id(*)
      `)
      .single();

    if (error) {
      console.error('Error creating agent:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error creating agent'
        }
      });
    }

    // Transform the data to match the expected format
    const transformedAgent = transformAgent(newAgent);

    return res.status(201).json({
      success: true,
      agent: transformedAgent
    });
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
export const updateAgent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl, companyId, capabilities, isPublic } = req.body;
    const userId = req.user?.id;

    // Check if agent exists and user has access
    const { data: existingAgent, error: fetchError } = await supabase
      .from('agents')
      .select('id, creator_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingAgent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Agent not found'
        }
      });
    }

    if (existingAgent.creator_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'access_denied',
          message: 'You do not have permission to update this agent'
        }
      });
    }

    // If companyId is provided, check if user has access to it
    if (companyId) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, creator_id')
        .eq('id', companyId)
        .single();

      if (companyError || !company) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'invalid_company',
            message: 'Company not found'
          }
        });
      }

      if (company.creator_id !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'company_access_denied',
            message: 'You do not have permission to associate agents with this company'
          }
        });
      }
    }

    // Prepare update object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.image_url = imageUrl;
    if (companyId !== undefined) updateData.company_id = companyId;
    if (capabilities !== undefined) updateData.capabilities = capabilities;
    if (isPublic !== undefined) updateData.is_public = isPublic;

    // Update the agent
    const { data: updatedAgent, error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        companies:company_id(*)
      `)
      .single();

    if (error) {
      console.error('Error updating agent:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error updating agent'
        }
      });
    }

    // Transform the data to match the expected format
    const transformedAgent = transformAgent(updatedAgent);

    return res.status(200).json({
      success: true,
      agent: transformedAgent
    });
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
export const deleteAgent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Check if agent exists and user has access
    const { data: existingAgent, error: fetchError } = await supabase
      .from('agents')
      .select('id, creator_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingAgent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Agent not found'
        }
      });
    }

    if (existingAgent.creator_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'access_denied',
          message: 'You do not have permission to delete this agent'
        }
      });
    }

    // Delete the agent
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting agent:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error deleting agent'
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Agent deleted successfully'
    });
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
export const likeAgent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Check if agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, likes')
      .eq('id', id)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Agent not found'
        }
      });
    }

    // Check if user has already liked the agent
    const { data: existingLike, error: likeError } = await supabase
      .from('agent_likes')
      .select('id')
      .eq('agent_id', id)
      .eq('user_id', userId)
      .single();

    if (existingLike) {
      // Unlike
      await supabase
        .from('agent_likes')
        .delete()
        .eq('id', existingLike.id);

      // Decrement likes counter
      await supabase
        .from('agents')
        .update({ likes: (agent.likes || 0) - 1 })
        .eq('id', id);

      return res.status(200).json({
        success: true,
        message: 'Agent unliked successfully',
        liked: false,
        likes: (agent.likes || 0) - 1
      });
    } else {
      // Like
      await supabase
        .from('agent_likes')
        .insert({
          agent_id: id,
          user_id: userId
        });

      // Increment likes counter
      await supabase
        .from('agents')
        .update({ likes: (agent.likes || 0) + 1 })
        .eq('id', id);

      return res.status(200).json({
        success: true,
        message: 'Agent liked successfully',
        liked: true,
        likes: (agent.likes || 0) + 1
      });
    }
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

    // Check if agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, views')
      .eq('id', id)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Agent not found'
        }
      });
    }

    // Increment views counter
    const { error } = await supabase
      .from('agents')
      .update({ views: (agent.views || 0) + 1 })
      .eq('id', id);

    if (error) {
      console.error('Error incrementing views:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error recording view'
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'View recorded successfully',
      views: (agent.views || 0) + 1
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
 */
export const searchAgents = async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'missing_query',
          message: 'Search query is required'
        }
      });
    }

    // Perform search with explicit join
    const { data: agents, error, count } = await supabase
      .from('agents')
      .select(`
        *,
        companies:company_id(*)
      `, { count: 'exact' })
      .eq('is_public', true)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error searching agents:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error searching agents'
        }
      });
    }

    // Transform the data to match the expected format
    const transformedAgents = transformAgents(agents);

    return res.status(200).json({
      success: true,
      query,
      agents: transformedAgents,
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit)
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
    // Use explicit join 
    const { data: agents, error } = await supabase
      .from('agents')
      .select(`
        *,
        companies:company_id(*)
      `)
      .eq('is_public', true)
      .or('is_featured.eq.true,rating.gte.4')
      .order('rating', { ascending: false })
      .limit(6);

    if (error) {
      console.error('Error fetching featured agents:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error fetching featured agents'
        }
      });
    }

    // Transform the data to match the expected format
    const transformedAgents = transformAgents(agents);

    return res.status(200).json({
      success: true,
      agents: transformedAgents
    });
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
    // Use explicit join
    const { data: agents, error } = await supabase
      .from('agents')
      .select(`
        *,
        companies:company_id(*)
      `)
      .eq('is_public', true)
      .order('views', { ascending: false })
      .limit(6);

    if (error) {
      console.error('Error fetching trending agents:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error fetching trending agents'
        }
      });
    }

    // Transform the data to match the expected format
    const transformedAgents = transformAgents(agents);

    return res.status(200).json({
      success: true,
      agents: transformedAgents
    });
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
    company: agent.companies ? { // Now using companies (plural) since that's our join alias
      id: agent.companies.id,
      name: agent.companies.name,
      logoUrl: agent.companies.logo_url,
      isVerified: agent.companies.is_verified,
      isEnterprise: agent.companies.is_enterprise
    } : null,
    createdAt: agent.created_at,
    isOwner: false, // Will be set by the caller if needed
    creator_id: agent.creator_id,
    company_id: agent.company_id,
    is_public: agent.is_public
  };
}
