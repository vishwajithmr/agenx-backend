import express from 'express';
import {
  getReviewSummary,
  getReviews,
  submitReview,
  editReview
} from '../controllers/reviewController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /agents/{agentId}/reviews:
 *   get:
 *     summary: Get reviews for an agent
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, highest, lowest, most_helpful]
 *           default: newest
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *     responses:
 *       200:
 *         description: List of reviews
 */
router.get('/:agentId/reviews', getReviews);

/**
 * @swagger
 * /agents/{agentId}/reviews/summary:
 *   get:
 *     summary: Get review summary for an agent
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review summary statistics
 */
router.get('/:agentId/reviews/summary', getReviewSummary);

/**
 * @swagger
 * /agents/{agentId}/reviews:
 *   post:
 *     summary: Submit a new review
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReviewRequest'
 *     responses:
 *       201:
 *         description: Review created successfully
 */
router.post('/:agentId/reviews', authenticateUser, submitReview);

/**
 * @swagger
 * /reviews/{reviewId}:
 *   put:
 *     summary: Edit a review
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateReviewRequest'
 *     responses:
 *       200:
 *         description: Review updated successfully
 */
router.put('/reviews/:reviewId', authenticateUser, editReview);

export default router;
