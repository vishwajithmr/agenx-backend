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
} from './controllers';
import { authenticateUser } from '../../../core/middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /agents:
 *   get:
 *     summary: Get all public agents
 *     description: Retrieve a list of all public agents.
 *     responses:
 *       200:
 *         description: A list of agents
 */
router.get('/', getAllAgents);

/**
 * @swagger
 * /agents/featured:
 *   get:
 *     summary: Get featured agents
 *     description: Retrieve a list of featured agents.
 *     responses:
 *       200:
 *         description: A list of featured agents
 */
router.get('/featured', getFeaturedAgents);

/**
 * @swagger
 * /agents/trending:
 *   get:
 *     summary: Get trending agents
 *     description: Retrieve a list of trending agents.
 *     responses:
 *       200:
 *         description: A list of trending agents
 */
router.get('/trending', getTrendingAgents);

/**
 * @swagger
 * /agents/search:
 *   get:
 *     summary: Search agents
 *     description: Search for agents based on query parameters.
 *     parameters:
 *       - name: query
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of agents matching the search criteria
 */
router.get('/search', searchAgents);

/**
 * @swagger
 * /agents/{id}:
 *   get:
 *     summary: Get agent by ID
 *     description: Retrieve details of an agent by its ID.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent details
 */
router.get('/:id', getAgentById);

/**
 * @swagger
 * /agents:
 *   post:
 *     summary: Create a new agent
 *     description: Create a new agent with the provided details.
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       201:
 *         description: Agent created successfully
 */
router.post('/', authenticateUser, createAgent);

/**
 * @swagger
 * /agents/{id}:
 *   put:
 *     summary: Update an agent
 *     description: Update the details of an existing agent.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
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
 *     responses:
 *       200:
 *         description: Agent updated successfully
 */
router.put('/:id', authenticateUser, updateAgent);

/**
 * @swagger
 * /agents/{id}:
 *   delete:
 *     summary: Delete an agent
 *     description: Delete an agent by its ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent deleted successfully
 */
router.delete('/:id', authenticateUser, deleteAgent);

/**
 * @swagger
 * /agents/{id}/like:
 *   post:
 *     summary: Like an agent
 *     description: Like an agent by its ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent liked successfully
 */
router.post('/:id/like', authenticateUser, likeAgent);

/**
 * @swagger
 * /agents/{id}/view:
 *   post:
 *     summary: View an agent
 *     description: Increment the view count for an agent by its ID.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent view count incremented successfully
 */
router.post('/:id/view', viewAgent);

export default router;