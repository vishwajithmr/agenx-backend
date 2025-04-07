import express from 'express';
import {
  getDiscussions,
  getDiscussion,
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  voteOnDiscussion,
  addComment,
  getComments,
  getNestedComments,
  voteOnComment,
  updateComment,
  deleteComment
} from './controllers';
import { authenticateUser } from '../../../core/middleware/auth';
import { optionalAuthUser } from '../../../core/middleware/optionalAuth';

const router = express.Router();

/**
 * @swagger
 * /api/discussions:
 *   get:
 *     tags: [Discussions]
 *     summary: Get discussions with filtering and pagination
 *     description: Retrieves discussions for a specific agent with pagination, sorting, and filtering options.
 *     parameters:
 *       - name: agentId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the agent to fetch discussions for
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of discussions per page
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *           enum: [latest, top, oldest]
 *           default: latest
 *         description: Sorting order
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search term to filter discussions
 *     responses:
 *       200:
 *         description: List of discussions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 discussions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DiscussionResponse'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationResponse'
 *       400:
 *         description: Invalid or missing parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/discussions', optionalAuthUser, getDiscussions);

/**
 * @swagger
 * /api/discussions/{discussionId}:
 *   get:
 *     tags: [Discussions]
 *     summary: Get a specific discussion with comments
 *     description: Retrieves a specific discussion with its comments.
 *     parameters:
 *       - name: discussionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the discussion to retrieve
 *       - name: commentPage
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for comments pagination
 *       - name: commentLimit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of top-level comments per page
 *       - name: commentSort
 *         in: query
 *         schema:
 *           type: string
 *           enum: [newest, oldest, top]
 *           default: top
 *         description: Sorting order for comments
 *     responses:
 *       200:
 *         description: Discussion details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 discussion:
 *                   $ref: '#/components/schemas/DiscussionDetailResponse'
 *       404:
 *         description: Discussion not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/discussions/:discussionId', optionalAuthUser, getDiscussion);

/**
 * @swagger
 * /api/discussions:
 *   post:
 *     tags: [Discussions]
 *     summary: Create a new discussion
 *     description: Creates a new discussion.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDiscussionRequest'
 *     responses:
 *       201:
 *         description: Discussion created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 discussion:
 *                   $ref: '#/components/schemas/DiscussionResponse'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/discussions', authenticateUser, createDiscussion);

/**
 * @swagger
 * /api/discussions/{discussionId}:
 *   put:
 *     tags: [Discussions]
 *     summary: Update a discussion
 *     description: Updates an existing discussion.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: discussionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the discussion to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateDiscussionRequest'
 *     responses:
 *       200:
 *         description: Discussion updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 discussion:
 *                   $ref: '#/components/schemas/DiscussionResponse'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Not author
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Discussion not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/discussions/:discussionId', authenticateUser, updateDiscussion);

/**
 * @swagger
 * /api/discussions/{discussionId}:
 *   delete:
 *     tags: [Discussions]
 *     summary: Delete a discussion
 *     description: Deletes a discussion.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: discussionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the discussion to delete
 *     responses:
 *       200:
 *         description: Discussion deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Discussion successfully deleted
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Not author
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Discussion not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/discussions/:discussionId', authenticateUser, deleteDiscussion);

/**
 * @swagger
 * /api/discussions/{discussionId}/vote:
 *   post:
 *     tags: [Discussions]
 *     summary: Vote on a discussion
 *     description: Upvotes, downvotes, or removes vote from a discussion.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: discussionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the discussion to vote on
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VoteRequest'
 *     responses:
 *       200:
 *         description: Vote recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 newScore:
 *                   type: integer
 *                 userVote:
 *                   type: integer
 *                   enum: [-1, 0, 1]
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Discussion not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/discussions/:discussionId/vote', authenticateUser, voteOnDiscussion);

/**
 * @swagger
 * /api/discussions/{discussionId}/comments:
 *   get:
 *     tags: [Discussions]
 *     summary: Get comments for a discussion
 *     description: Retrieves paginated comments for a specific discussion.
 *     parameters:
 *       - name: discussionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the discussion to get comments for
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of comments per page
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *           enum: [newest, oldest, top]
 *           default: top
 *         description: Sorting order
 *       - name: parentCommentId
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *         description: If provided, returns replies to the specified comment
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 comments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CommentResponse'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationResponse'
 *       404:
 *         description: Discussion not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/discussions/:discussionId/comments', optionalAuthUser, getComments);

/**
 * @swagger
 * /api/discussions/{discussionId}/nested-comments:
 *   get:
 *     tags: [Discussions]
 *     summary: Get complete nested comment hierarchy for a discussion
 *     description: Retrieves the entire tree of comments including all nested replies for a discussion.
 *     parameters:
 *       - name: discussionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the discussion to get comments for
 *     responses:
 *       200:
 *         description: Complete comment tree
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 comments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CommentResponse'
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     discussionId:
 *                       type: string
 *                       format: uuid
 *       404:
 *         description: Discussion not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/discussions/:discussionId/nested-comments', optionalAuthUser, getNestedComments);

/**
 * @swagger
 * /api/discussions/{discussionId}/comments:
 *   post:
 *     tags: [Discussions]
 *     summary: Add a comment to a discussion
 *     description: Adds a new comment or reply to a discussion.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: discussionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the discussion to comment on
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCommentRequest'
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 comment:
 *                   $ref: '#/components/schemas/CommentResponse'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Discussion or parent comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/discussions/:discussionId/comments', authenticateUser, addComment);

/**
 * @swagger
 * /api/comments/{commentId}/vote:
 *   post:
 *     tags: [Discussions]
 *     summary: Vote on a comment
 *     description: Upvotes, downvotes, or removes vote from a comment.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: commentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the comment to vote on
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VoteRequest'
 *     responses:
 *       200:
 *         description: Vote recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 commentId:
 *                   type: string
 *                   format: uuid
 *                 newScore:
 *                   type: integer
 *                 userVote:
 *                   type: integer
 *                   enum: [-1, 0, 1]
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/comments/:commentId/vote', authenticateUser, voteOnComment);

/**
 * @swagger
 * /api/comments/{commentId}:
 *   put:
 *     tags: [Discussions]
 *     summary: Update a comment
 *     description: Updates an existing comment.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: commentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the comment to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCommentRequest'
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 comment:
 *                   $ref: '#/components/schemas/CommentResponse'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Not author
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/comments/:commentId', authenticateUser, updateComment);

/**
 * @swagger
 * /api/comments/{commentId}:
 *   delete:
 *     tags: [Discussions]
 *     summary: Delete a comment
 *     description: Deletes a comment.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: commentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the comment to delete
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Comment successfully deleted
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Not author
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/comments/:commentId', authenticateUser, deleteComment);

export default router;