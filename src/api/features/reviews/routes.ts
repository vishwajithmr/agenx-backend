import express from 'express';
import {
  getReviewSummary,
  getReviews,
  submitReview,
  editReview,
  deleteReview
} from './controllers';
import { authenticateUser } from '../../../core/middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /agents/{agentId}/reviews:
 *   get:
 *     summary: Get reviews for a specific agent
 *     parameters:
 *       - name: agentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the agent
 *     responses:
 *       200:
 *         description: List of reviews
 *       404:
 *         description: Agent not found
 */
router.get('/agents/:agentId/reviews', getReviews);

/**
 * @swagger
 * /agents/{agentId}/reviews/summary:
 *   get:
 *     summary: Get review summary for a specific agent
 *     parameters:
 *       - name: agentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the agent
 *     responses:
 *       200:
 *         description: Review summary
 *       404:
 *         description: Agent not found
 */
router.get('/agents/:agentId/reviews/summary', getReviewSummary);

/**
 * @swagger
 * /agents/{agentId}/reviews:
 *   post:
 *     summary: Submit a review for a specific agent
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReviewRequest'
 *     parameters:
 *       - name: agentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the agent
 *     responses:
 *       201:
 *         description: Review submitted successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 */
router.post('/agents/:agentId/reviews', authenticateUser, submitReview);

/**
 * @swagger
 * /reviews/{reviewId}:
 *   put:
 *     summary: Edit a review
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateReviewRequest'
 *     parameters:
 *       - name: reviewId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the review
 *     responses:
 *       200:
 *         description: Review updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Review not found
 */
router.put('/reviews/:reviewId', authenticateUser, editReview);

/**
 * @swagger
 * /reviews/{reviewId}:
 *   delete:
 *     summary: Delete a review
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: reviewId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the review
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Review not found
 */
router.delete('/reviews/:reviewId', authenticateUser, deleteReview);

export default router;