const express = require('express');
const authRoutes = require('./auth');
const agentRoutes = require('./agents');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/agents', agentRoutes);

module.exports = router;
