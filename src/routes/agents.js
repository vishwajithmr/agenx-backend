const express = require('express');
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
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
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const userId = req.headers.authorization ? (await supabase.auth.getUser(req.headers.authorization.split(' ')[1]))?.data?.user?.id : null;

    // Get all agents without is_public filter since the column doesn't exist
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) throw error;
    
    // Get company data separately for agents with company_id
    const agentsWithCompanies = await Promise.all(
      agents.map(async (agent) => {
        let company = null;
        
        if (agent.company_id) {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('*')
            .eq('id', agent.company_id)
            .single();
            
          if (!companyError && companyData) {
            company = {
              id: companyData.id,
              name: companyData.name,
              logoUrl: companyData.logo_url,
              isVerified: companyData.is_verified,
              isEnterprise: companyData.is_enterprise
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
  } catch (error) {
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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers.authorization ? (await supabase.auth.getUser(req.headers.authorization.split(' ')[1]))?.data?.user?.id : null;
    
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
    
    // Get company data if agent has company_id
    let company = null;
    if (agent.company_id) {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', agent.company_id)
        .single();
        
      if (!companyError && companyData) {
        company = {
          id: companyData.id,
          name: companyData.name,
          logoUrl: companyData.logo_url,
          isVerified: companyData.is_verified,
          isEnterprise: companyData.is_enterprise
        };
      }
    }
    
    // Format the response
    const formattedAgent = {
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
    
    res.status(200).json(formattedAgent);
  } catch (error) {
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
router.post('/', authenticate, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      imageUrl, 
      isPro, 
      capabilities = [], 
      company = null 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Create insert object
    const agentData = {
      name,
      description,
      image_url: imageUrl,
      is_pro: isPro || false,
      capabilities,
      company_id: company?.id || null,
      likes: 0,
      views: 0,
      rating: 0,
      usage_count: 0
    };
    
    // Add creator_id separately to handle possible schema cache issues
    try {
      agentData.creator_id = req.user.id;
    } catch (error) {
      console.warn('Could not set creator_id, continuing without it:', error.message);
    }
    
    // Insert agent
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
            company_id: company?.id || null,
            likes: 0,
            views: 0,
            rating: 0,
            usage_count: 0
          })
          .select()
          .single();
          
        if (fallbackError) throw fallbackError;
        agent = fallbackAgent;
      } else {
        throw error;
      }
    }
    
    // If a new company was provided without an ID, create it
    if (company && !company.id && company.name) {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: company.name,
          logo_url: company.logoUrl,
          is_verified: company.isVerified || false,
          is_enterprise: company.isEnterprise || false,
          creator_id: req.user.id
        })
        .select()
        .single();
        
      if (companyError) throw companyError;
      
      // Update the agent with the new company ID
      const { error: updateError } = await supabase
        .from('agents')
        .update({
          company_id: newCompany.id
        })
        .eq('id', agent.id);
        
      if (updateError) throw updateError;
      
      // Get the updated agent
      const { data: updatedAgent, error: getError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agent.id)
        .single();
        
      if (getError) throw getError;
      
      // Format the response
      const formattedAgent = {
        id: updatedAgent.id,
        name: updatedAgent.name,
        description: updatedAgent.description,
        imageUrl: updatedAgent.image_url,
        isPro: updatedAgent.is_pro,
        likes: updatedAgent.likes || 0,
        views: updatedAgent.views || 0,
        rating: updatedAgent.rating || 0,
        usageCount: updatedAgent.usage_count || 0,
        capabilities: updatedAgent.capabilities || [],
        company: {
          id: newCompany.id,
          name: newCompany.name,
          logoUrl: newCompany.logo_url,
          isVerified: newCompany.is_verified,
          isEnterprise: newCompany.is_enterprise
        },
        createdAt: updatedAgent.created_at,
        isOwner: true
      };
      
      return res.status(201).json({ message: 'Agent created successfully', agent: formattedAgent });
    }
    
    // Format the response for agent without new company
    const formattedAgent = {
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
      company: company,
      createdAt: agent.created_at,
      isOwner: true
    };
    
    res.status(201).json({ message: 'Agent created successfully', agent: formattedAgent });
  } catch (error) {
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
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      imageUrl, 
      isPro, 
      capabilities = [], 
      company = null
    } = req.body;
    
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
    
    if (existingAgent.creator_id !== req.user.id) {
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
        company_id: company?.id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
      
    if (updateError) throw updateError;
    
    // Create new company if needed
    let companyData = null;
    if (company && !company.id && company.name) {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: company.name,
          logo_url: company.logoUrl,
          is_verified: company.isVerified || false,
          is_enterprise: company.isEnterprise || false,
          creator_id: req.user.id
        })
        .select()
        .single();
        
      if (companyError) throw companyError;
      
      // Update the agent with the new company ID
      await supabase
        .from('agents')
        .update({
          company_id: newCompany.id
        })
        .eq('id', id);
      
      companyData = {
        id: newCompany.id,
        name: newCompany.name,
        logoUrl: newCompany.logo_url,
        isVerified: newCompany.is_verified,
        isEnterprise: newCompany.is_enterprise
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
        companyData = {
          id: existingCompany.id,
          name: existingCompany.name,
          logoUrl: existingCompany.logo_url,
          isVerified: existingCompany.is_verified,
          isEnterprise: existingCompany.is_enterprise
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
    
    // Return formatted agent
    const formattedAgent = {
      id: updatedAgent.id,
      name: updatedAgent.name,
      description: updatedAgent.description,
      imageUrl: updatedAgent.image_url,
      isPro: updatedAgent.is_pro,
      likes: updatedAgent.likes || 0,
      views: updatedAgent.views || 0,
      rating: updatedAgent.rating || 0,
      usageCount: updatedAgent.usage_count || 0,
      capabilities: updatedAgent.capabilities || [],
      company: companyData || company,
      createdAt: updatedAgent.created_at,
      isOwner: true
    };
    
    res.status(200).json({ message: 'Agent updated successfully', agent: formattedAgent });
  } catch (error) {
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
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check if user owns this agent
    const { data: existingAgent, error: checkError } = await supabase
      .from('agents')
      .select('creator_id')
      .eq('id', id)
      .single();
      
    if (checkError) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    if (existingAgent.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this agent' });
    }
    
    // Prepare update object
    const updateData = {};
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
    let companyData = null;
    if (updates.company && !updates.company.id && updates.company.name) {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: updates.company.name,
          logo_url: updates.company.logoUrl,
          is_verified: updates.company.isVerified || false,
          is_enterprise: updates.company.isEnterprise || false,
          creator_id: req.user.id
        })
        .select()
        .single();
        
      if (companyError) throw companyError;
      
      // Update the agent with the new company ID
      await supabase
        .from('agents')
        .update({
          company_id: newCompany.id
        })
        .eq('id', id);
      
      companyData = {
        id: newCompany.id,
        name: newCompany.name,
        logoUrl: newCompany.logo_url,
        isVerified: newCompany.is_verified,
        isEnterprise: newCompany.is_enterprise
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
        companyData = {
          id: existingCompany.id,
          name: existingCompany.name,
          logoUrl: existingCompany.logo_url,
          isVerified: existingCompany.is_verified,
          isEnterprise: existingCompany.is_enterprise
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
    
    // Get company data if needed and not already fetched
    if (!companyData && updatedAgent.company_id) {
      const { data: companyData2, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', updatedAgent.company_id)
        .single();
        
      if (!companyError && companyData2) {
        companyData = {
          id: companyData2.id,
          name: companyData2.name,
          logoUrl: companyData2.logo_url,
          isVerified: companyData2.is_verified,
          isEnterprise: companyData2.is_enterprise
        };
      }
    }
    
    // Return formatted agent
    const formattedAgent = {
      id: updatedAgent.id,
      name: updatedAgent.name,
      description: updatedAgent.description,
      imageUrl: updatedAgent.image_url,
      isPro: updatedAgent.is_pro,
      likes: updatedAgent.likes || 0,
      views: updatedAgent.views || 0,
      rating: updatedAgent.rating || 0,
      usageCount: updatedAgent.usage_count || 0,
      capabilities: updatedAgent.capabilities || [],
      company: companyData,
      createdAt: updatedAgent.created_at,
      isOwner: true
    };
    
    res.status(200).json({ message: 'Agent updated successfully', agent: formattedAgent });
  } catch (error) {
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
router.delete('/:id', authenticate, async (req, res) => {
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
    
    if (existingAgent.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this agent' });
    }
    
    // Delete the agent
    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .eq('id', id);
      
    if (deleteError) throw deleteError;
    
    res.status(200).json({ message: 'Agent deleted successfully' });
  } catch (error) {
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
router.post('/:id/like', async (req, res) => {
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
