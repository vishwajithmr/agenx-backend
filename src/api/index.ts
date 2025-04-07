import express from 'express';
import authRoutes from './features/auth/routes';
import agentRoutes from './features/agents/routes';
import reviewRoutes from './features/reviews/routes';
import discussionRoutes from './features/discussions/routes';

const router = express.Router();

// API Routes
router.use('/auth', authRoutes);
router.use('/agents', agentRoutes);
router.use('/api', discussionRoutes); // Discussion routes start with /api
router.use('/', reviewRoutes); // Review routes are mounted at root level

export default router;
