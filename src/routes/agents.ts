import express, { Request, Response } from 'express';
import supabase from '../config/supabase';
import { authenticate } from '../middleware/auth';
import { Agent, AgentResponse, AuthenticatedRequest, Company, DbAgent, DbCompany } from '../types';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Agent:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         imageUrl:
 *           type: string
 *         isPro:
 *           type: boolean
 *         likes:
 *           type: integer
 *         views:
 *           type: integer
 *         rating:
 *           type: number
 *           format: float
 *         usageCount:
 *           type: integer
 *         capabilities:
 *           type: array
 *           items:
 *             type: string
 *         company:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *             logoUrl:
 *               type: string
 *             isVerified:
 *               type: boolean
 *             isEnterprise:
 *               type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         isOwner:
 *           type: boolean
 */

/**
 * @swagger
 * /agents:
 *   get:
 *     summary: Get all available agents
 *     tags: [Agents]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of agents to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of agents to skip
 *     responses:
 *       200:
 *         description: List of all agents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agent'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    let userId: string | null = null;
    
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id || null;
    }

    // Get all agents without is_public filter since the column doesn't exist
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) throw error;
    
    // Get company data separately for agents with company_id
    const agentsWithCompanies: Agent[] = await Promise.all(
      agents.map(async (agent: DbAgent) => {
        let company: Company | null = null;
        
        if (agent.company_id) {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('*')
            .eq('id', agent.company_id)
            .single();
            
          if (!companyError && companyData) {
            const dbCompany = companyData as DbCompany;
            company = {
              id: dbCompany.id,
              name: dbCompany.name,
              logoUrl: dbCompany.logo_url,
              isVerified: dbCompany.is_verified,
              isEnterprise: dbCompany.is_enterprise
            };
          }
        }
        
        return {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          imageUrl: agent.image_url,
          isPro: agent.is_pro,
          likes: agent.likes || 0,
          views: agent.views || 0,
          rating: agent.rating || 0,
          usageCount: agent.usage_count || 0,
          capabilities: agent.capabilities || [],
          company,
          createdAt: agent.created_at,
          isOwner: userId ? agent.creator_id === userId : false
        };
      })
    );
    
    res.status(200).json({ agents: agentsWithCompanies });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /agents/{id}:
 *   get:
 *     summary: Get agent by ID
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       404:
 *         description: Agent not found
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let userId: string | null = null;
    
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id || null;
    }
    
    // Increment views counter
    await supabase.rpc('increment_agent_views', { agent_id: id });
    
    // Get agent data
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const dbAgent = agent as DbAgent;
    
    // Get company data if agent has company_id
    let company: Company | null = null;
    if (dbAgent.company_id) {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', dbAgent.company_id)
        .single();
        
      if (!companyError && companyData) {
        const dbCompany = companyData as DbCompany;
        company = {
          id: dbCompany.id,
          name: dbCompany.name,
          logoUrl: dbCompany.logo_url,
          isVerified: dbCompany.is_verified,
          isEnterprise: dbCompany.is_enterprise
        };
      }
    }
    
    // Format the response
    const formattedAgent: Agent = {
      id: dbAgent.id,
      name: dbAgent.name,
      description: dbAgent.description,
      imageUrl: dbAgent.image_url,
      isPro: dbAgent.is_pro,
      likes: dbAgent.likes || 0,
      views: dbAgent.views || 0,
      rating: dbAgent.rating || 0,
      usageCount: dbAgent.usage_count || 0,
      capabilities: dbAgent.capabilities || [],
      company,
      createdAt: dbAgent.created_at,
      isOwner: userId ? dbAgent.creator_id === userId : false
    };
    
    res.status(200).json(formattedAgent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /agents:
 *   post:
 *     summary: Create a new agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               isPro:
 *                 type: boolean
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               company:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   logoUrl:
 *                     type: string
 *                   isVerified:
 *                     type: boolean
 *                   isEnterprise:
 *                     type: boolean
 *     responses:
 *       201:
 *         description: Agent created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      name, 
      description, 
      imageUrl, 
      isPro, 
      capabilities = [], 
      company = null 
    }: Agent = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Create insert object
    const agentData: Partial<DbAgent> = {
      name,
      description,
      image_url: imageUrl,
      is_pro: isPro || false,
      capabilities,
      company_id: company?.id || undefined, // Change `null` to `undefined`
      likes: 0,
      views: 0,
      rating: 0,
      usage_count: 0
    };
    
    // Add creator_id if user exists
    if (req.user?.id) {
      agentData.creator_id = req.user.id;
    }
    
    // Insert agent
    let insertedAgent: DbAgent;
    const { data: agent, error } = await supabase
      .from('agents')
      .insert(agentData)
      .select()
      .single();
      
    if (error) {
      if (error.message.includes('creator_id')) {
        // Fall back to inserting without creator_id if there's an issue
        const { data: fallbackAgent, error: fallbackError } = await supabase
          .from('agents')
          .insert({
            name,
            description,
            image_url: imageUrl,
            is_pro: isPro || false,
            capabilities,
            company_id: company?.id || undefined, // Change `null` to `undefined`
            likes: 0,
            views: 0,
            rating: 0,
            usage_count: 0
          })
          .select()
          .single();
          
        if (fallbackError) throw fallbackError;
        insertedAgent = fallbackAgent as DbAgent;
      } else {
        throw error;
      }
    } else {
      insertedAgent = agent as DbAgent;
    }
    
    // If a new company was provided without an ID, create it
    if (company && !company.id && company.name) {
      const companyData: Partial<DbCompany> = {
        name: company.name,
        logo_url: company.logoUrl,
        is_verified: company.isVerified || false,
        is_enterprise: company.isEnterprise || false
      };
      
      if (req.user?.id) {
        companyData.creator_id = req.user.id;
      }
      
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert(companyData)
        .select()
        .single();
        
      if (companyError) throw companyError;
      
      const newDbCompany = newCompany as DbCompany;
      
      // Update the agent with the new company ID
      const { error: updateError } = await supabase
        .from('agents')
        .update({
          company_id: newDbCompany.id
        })
        .eq('id', insertedAgent.id);
        
      if (updateError) throw updateError;
      
      // Get the updated agent
      const { data: updatedAgent, error: getError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', insertedAgent.id)
        .single();
        
      if (getError) throw getError;
      
      const dbUpdatedAgent = updatedAgent as DbAgent;
      
      // Format the response
      const formattedAgent: Agent = {
        id: dbUpdatedAgent.id,
        name: dbUpdatedAgent.name,
        description: dbUpdatedAgent.description,
        imageUrl: dbUpdatedAgent.image_url,
        isPro: dbUpdatedAgent.is_pro,
        likes: dbUpdatedAgent.likes || 0,
        views: dbUpdatedAgent.views || 0,
        rating: dbUpdatedAgent.rating || 0,
        usageCount: dbUpdatedAgent.usage_count || 0,
        capabilities: dbUpdatedAgent.capabilities || [],
        company: {
          id: newDbCompany.id,
          name: newDbCompany.name,
          logoUrl: newDbCompany.logo_url,
          isVerified: newDbCompany.is_verified,
          isEnterprise: newDbCompany.is_enterprise
        },
        createdAt: dbUpdatedAgent.created_at,
        isOwner: true
      };
      
      return res.status(201).json({ 
        message: 'Agent created successfully', 
        agent: formattedAgent 
      } as AgentResponse);
    }
    
    // Format the response for agent without new company
    const formattedAgent: Agent = {
      id: insertedAgent.id,
      name: insertedAgent.name,
      description: insertedAgent.description,
      imageUrl: insertedAgent.image_url,
      isPro: insertedAgent.is_pro,
      likes: insertedAgent.likes || 0,
      views: insertedAgent.views || 0,
      rating: insertedAgent.rating || 0,
      usageCount: insertedAgent.usage_count || 0,
      capabilities: insertedAgent.capabilities || [],
      company: company,
      createdAt: insertedAgent.created_at,
      isOwner: true
    };
    
    res.status(201).json({ 
      message: 'Agent created successfully', 
      agent: formattedAgent 
    } as AgentResponse);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /agents/{id}:
 *   put:
 *     summary: Update an agent completely
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               isPro:
 *                 type: boolean
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               company:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   logoUrl:
 *                     type: string
 *                   isVerified:
 *                     type: boolean
 *                   isEnterprise:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Agent updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Agent not found
 */
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      imageUrl, 
      isPro, 
      capabilities = [], 
      company = null
    }: Agent = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Check if user owns this agent
    const { data: existingAgent, error: checkError } = await supabase
      .from('agents')
      .select('creator_id')
      .eq('id', id)
      .single();
      
    if (checkError) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    if (req.user && existingAgent.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this agent' });
    }
    
    // Update the agent
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        name,
        description,
        image_url: imageUrl,
        is_pro: isPro || false,
        capabilities,
        company_id: company?.id || undefined, // Change `null` to `undefined`
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
      
    if (updateError) throw updateError;
    
    // Create new company if needed
    let companyData: Company | null = null;
    if (company && !company.id && company.name) {
      const newCompanyData: Partial<DbCompany> = {
        name: company.name,
        logo_url: company.logoUrl,
        is_verified: company.isVerified || false,
        is_enterprise: company.isEnterprise || false
      };
      
      if (req.user?.id) {
        newCompanyData.creator_id = req.user.id;
      }
      
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert(newCompanyData)
        .select()
        .single();
        
      if (companyError) throw companyError;
      
      const newDbCompany = newCompany as DbCompany;
      
      // Update the agent with the new company ID
      await supabase
        .from('agents')
        .update({
          company_id: newDbCompany.id
        })
        .eq('id', id);
      
      companyData = {
        id: newDbCompany.id,
        name: newDbCompany.name,
        logoUrl: newDbCompany.logo_url,
        isVerified: newDbCompany.is_verified,
        isEnterprise: newDbCompany.is_enterprise
      };
    } 
    // Get company data if needed
    else if (company && company.id) {
      const { data: existingCompany, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', company.id)
        .single();
        
      if (!companyError && existingCompany) {
        const dbExistingCompany = existingCompany as DbCompany;
        companyData = {
          id: dbExistingCompany.id,
          name: dbExistingCompany.name,
          logoUrl: dbExistingCompany.logo_url,
          isVerified: dbExistingCompany.is_verified,
          isEnterprise: dbExistingCompany.is_enterprise
        };
      }
    }
    
    // Get updated agent data
    const { data: updatedAgent, error: getError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();
      
    if (getError) throw getError;
    
    const dbUpdatedAgent = updatedAgent as DbAgent;
    
    // Return formatted agent
    const formattedAgent: Agent = {
      id: dbUpdatedAgent.id,
      name: dbUpdatedAgent.name,
      description: dbUpdatedAgent.description,
      imageUrl: dbUpdatedAgent.image_url,
      isPro: dbUpdatedAgent.is_pro,
      likes: dbUpdatedAgent.likes || 0,
      views: dbUpdatedAgent.views || 0,
      rating: dbUpdatedAgent.rating || 0,
      usageCount: dbUpdatedAgent.usage_count || 0,
      capabilities: dbUpdatedAgent.capabilities || [],
      company: companyData || company,
      createdAt: dbUpdatedAgent.created_at,
      isOwner: true
    };
    
    res.status(200).json({ 
      message: 'Agent updated successfully', 
      agent: formattedAgent 
    } as AgentResponse);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /agents/{id}:
 *   patch:
 *     summary: Partially update an agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               isPro:
 *                 type: boolean
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               company:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   logoUrl:
 *                     type: string
 *                   isVerified:
 *                     type: boolean
 *                   isEnterprise:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Agent updated successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Agent not found
 */
router.patch('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates: Partial<Agent> = req.body;
    
    // Check if user owns this agent
    const { data: existingAgent, error: checkError } = await supabase
      .from('agents')
      .select('creator_id')
      .eq('id', id)
      .single();
      
    if (checkError) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    if (req.user && existingAgent.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this agent' });
    }
    
    // Prepare update object
    const updateData: Partial<DbAgent> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
    if (updates.isPro !== undefined) updateData.is_pro = updates.isPro;
    if (updates.capabilities !== undefined) updateData.capabilities = updates.capabilities;
    if (updates.company && updates.company.id) updateData.company_id = updates.company.id;
    
    updateData.updated_at = new Date().toISOString();
    
    // Update the agent
    const { error: updateError } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', id);
      
    if (updateError) throw updateError;
    
    // Create new company if needed
    let companyData: Company | null = null;
    if (updates.company && !updates.company.id && updates.company.name) {
      const newCompanyData: Partial<DbCompany> = {
        name: updates.company.name,
        logo_url: updates.company.logoUrl,
        is_verified: updates.company.isVerified || false,
        is_enterprise: updates.company.isEnterprise || false
      };
      
      if (req.user?.id) {
        newCompanyData.creator_id = req.user.id;
      }
      
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert(newCompanyData)
        .select()
        .single();
        
      if (companyError) throw companyError;
      
      const newDbCompany = newCompany as DbCompany;
      
      // Update the agent with the new company ID
      await supabase
        .from('agents')
        .update({
          company_id: newDbCompany.id
        })
        .eq('id', id);
      
      companyData = {
        id: newDbCompany.id,
        name: newDbCompany.name,
        logoUrl: newDbCompany.logo_url,
        isVerified: newDbCompany.is_verified,
        isEnterprise: newDbCompany.is_enterprise
      };
    } 
    // Get company data if needed
    else if (updates.company && updates.company.id) {
      const { data: existingCompany, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', updates.company.id)
        .single();
        
      if (!companyError && existingCompany) {
        const dbExistingCompany = existingCompany as DbCompany;
        companyData = {
          id: dbExistingCompany.id,
          name: dbExistingCompany.name,
          logoUrl: dbExistingCompany.logo_url,
          isVerified: dbExistingCompany.is_verified,
          isEnterprise: dbExistingCompany.is_enterprise
        };
      }
    }
    
    // Get updated agent data
    const { data: updatedAgent, error: getError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();
      
    if (getError) throw getError;
    
    const dbUpdatedAgent = updatedAgent as DbAgent;
    
    // Get company data if needed and not already fetched
    if (!companyData && dbUpdatedAgent.company_id) {
      const { data: companyData2, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', dbUpdatedAgent.company_id)
        .single();
        
      if (!companyError && companyData2) {
        const dbCompany2 = companyData2 as DbCompany;
        companyData = {
          id: dbCompany2.id,
          name: dbCompany2.name,
          logoUrl: dbCompany2.logo_url,
          isVerified: dbCompany2.is_verified,
          isEnterprise: dbCompany2.is_enterprise
        };
      }
    }
    
    // Return formatted agent
    const formattedAgent: Agent = {
      id: dbUpdatedAgent.id,
      name: dbUpdatedAgent.name,
      description: dbUpdatedAgent.description,
      imageUrl: dbUpdatedAgent.image_url,
      isPro: dbUpdatedAgent.is_pro,
      likes: dbUpdatedAgent.likes || 0,
      views: dbUpdatedAgent.views || 0,
      rating: dbUpdatedAgent.rating || 0,
      usageCount: dbUpdatedAgent.usage_count || 0,
      capabilities: dbUpdatedAgent.capabilities || [],
      company: companyData,
      createdAt: dbUpdatedAgent.created_at,
      isOwner: true
    };
    
    res.status(200).json({ 
      message: 'Agent updated successfully', 
      agent: formattedAgent 
    } as AgentResponse);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /agents/{id}:
 *   delete:
 *     summary: Delete an agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Agent not found
 */
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if user owns this agent
    const { data: existingAgent, error: checkError } = await supabase
      .from('agents')
      .select('creator_id')
      .eq('id', id)
      .single();
      
    if (checkError) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    if (req.user && existingAgent.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this agent' });
    }
    
    // Delete the agent
    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .eq('id', id);
      
    if (deleteError) throw deleteError;
    
    res.status(200).json({ message: 'Agent deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /agents/{id}/like:
 *   post:
 *     summary: Like an agent
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent liked successfully
 *       404:
 *         description: Agent not found
 */
router.post('/:id/like', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if agent exists
    const { data: agent, error: checkError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', id)
      .single();
      
    if (checkError) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Increment likes counter
    await supabase.rpc('like_agent', { agent_id: id });
    
    res.status(200).json({ message: 'Agent liked successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
