import express from 'express';
import authRoutes from './auth';
import agentRoutes from './agents';
import reviewRoutes from './reviews';

const router = express.Router();

// Define routes
router.use('/auth', authRoutes);
router.use('/agents', agentRoutes);
router.use('/agents', reviewRoutes);

export default router;
