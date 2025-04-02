import express from 'express';
import authRoutes from './features/auth/routes';
import agentRoutes from './features/agents/routes';
import reviewRoutes from './features/reviews/routes';

const router = express.Router();

// Define routes
router.use('/auth', authRoutes);
router.use('/agents', agentRoutes);
// Mount the reviews routes at both agent path and root path
router.use('/agents', reviewRoutes); // For agent-specific review endpoints
router.use('/', reviewRoutes);      // For standalone review endpoints like delete

export default router;
