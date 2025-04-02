import { Request, Response } from 'express';
import { supabase } from '../../../db/config/supabase';
import { Agent } from '../../../shared/types';

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
  // ...existing code...
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
    creator_id: agent.creator_id,
    company_id: agent.company_id,
    is_public: agent.is_public
  };
}