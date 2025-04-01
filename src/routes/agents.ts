import express from 'express';
import { 
  getAllAgents, 
  getAgentById, 
  createAgent, 
  updateAgent, 
  deleteAgent,
  likeAgent,
  viewAgent,
  searchAgents,
  getFeaturedAgents,
  getTrendingAgents
} from '../controllers/agentController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /agents:
 *   get:
 *     summary: Get all public agents
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: A list of agents
 */
router.get('/agents', getAllAgents);

/**
 * @swagger
 * /agents/featured:
 *   get:
 *     summary: Get featured agents
 *     responses:
 *       200:
 *         description: A list of featured agents
 */
router.get('/agents/featured', getFeaturedAgents);

/**
 * @swagger
 * /agents/trending:
 *   get:
 *     summary: Get trending agents
 *     responses:
 *       200:
 *         description: A list of trending agents
 */
router.get('/agents/trending', getTrendingAgents);

/**
 * @swagger
 * /agents/search:
 *   get:
 *     summary: Search for agents
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/agents/search', searchAgents);

/**
 * @swagger
 * /agents/{id}:
 *   get:
 *     summary: Get an agent by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The agent ID
 *     responses:
 *       200:
 *         description: Agent details
 *       404:
 *         description: Agent not found
 */
router.get('/agents/:id', getAgentById);

/**
 * @swagger
 * /agents:
 *   post:
 *     summary: Create a new agent
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
 *               companyId:
 *                 type: string
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Agent created
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/agents', authenticateUser, createAgent);

/**
 * @swagger
 * /agents/{id}:
 *   put:
 *     summary: Update an agent
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The agent ID
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
 *               companyId:
 *                 type: string
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Agent updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
router.put('/agents/:id', authenticateUser, updateAgent);

/**
 * @swagger
 * /agents/{id}:
 *   delete:
 *     summary: Delete an agent
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The agent ID
 *     responses:
 *       200:
 *         description: Agent deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
router.delete('/agents/:id', authenticateUser, deleteAgent);

/**
 * @swagger
 * /agents/{id}/like:
 *   post:
 *     summary: Like an agent
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The agent ID
 *     responses:
 *       200:
 *         description: Like recorded
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
router.post('/agents/:id/like', authenticateUser, likeAgent);

/**
 * @swagger
 * /agents/{id}/view:
 *   post:
 *     summary: Record a view for an agent
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The agent ID
 *     responses:
 *       200:
 *         description: View recorded
 *       404:
 *         description: Agent not found
 */
router.post('/agents/:id/view', viewAgent);

export default router;
