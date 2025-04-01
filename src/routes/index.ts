import express from 'express';
import authRoutes from './auth';
import agentRoutes from './agents';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/agents', agentRoutes);

export default router;
