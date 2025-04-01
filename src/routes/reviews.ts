import express from 'express';
import {
  getReviewSummary,
  getReviews,
  submitReview,
  editReview,
  deleteReview,
  replyToReview,
  deleteReply,
  voteReview
} from '../controllers/reviewController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/agents/{agentId}/reviews:
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
router.get('/agents/:agentId/reviews', getReviews);

/**
 * @swagger
 * /api/agents/{agentId}/reviews/summary:
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
router.get('/agents/:agentId/reviews/summary', getReviewSummary);

/**
 * @swagger
 * /api/agents/{agentId}/reviews:
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
router.post('/agents/:agentId/reviews', authenticateUser, submitReview);

/**
 * @swagger
 * /api/reviews/{reviewId}:
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

/**
 * @swagger
 * /api/reviews/{reviewId}:
 *   delete:
 *     summary: Delete a review
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review deleted successfully
 */
router.delete('/reviews/:reviewId', authenticateUser, deleteReview);

/**
 * @swagger
 * /api/reviews/{reviewId}/replies:
 *   post:
 *     summary: Reply to a review
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
 *             $ref: '#/components/schemas/CreateReplyRequest'
 *     responses:
 *       201:
 *         description: Reply created successfully
 */
router.post('/reviews/:reviewId/replies', authenticateUser, replyToReview);

/**
 * @swagger
 * /api/reviews/replies/{replyId}:
 *   delete:
 *     summary: Delete a reply
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: replyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reply deleted successfully
 */
router.delete('/reviews/replies/:replyId', authenticateUser, deleteReply);

/**
 * @swagger
 * /api/reviews/{reviewId}/vote:
 *   post:
 *     summary: Vote on a review
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
 *             $ref: '#/components/schemas/VoteRequest'
 *     responses:
 *       200:
 *         description: Vote recorded successfully
 */
router.post('/reviews/:reviewId/vote', authenticateUser, voteReview);

export default router;
