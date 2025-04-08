import { Request, Response } from 'express';
import { format } from 'date-fns';
import { supabase, getAuthenticatedClient } from '../../../db/config/supabase';
import { ReviewResponse, ReviewSummary, AuthenticatedRequest } from '../../../shared/types';

/**
 * Get review summary for an agent
 */
export const getReviewSummary = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;

    // Get review summary from view
    const { data: summaryData, error: summaryError } = await supabase
      .from('review_summary')
      .select('*')
      .eq('agent_id', agentId)
      .maybeSingle(); // Use maybeSingle to allow null results

    if (summaryError) {
      console.error('Error fetching review summary:', summaryError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'summary_error',
          message: 'Error retrieving review summary'
        }
      });
    }

    // If no summary data, return default values
    if (!summaryData) {
      return res.status(200).json({
        success: true,
        summary: {
          averageRating: 0,
          totalReviews: 0,
          credibilityScore: 0,
          credibilityBadge: 'not-rated',
          recentPositivePercentage: 0,
          ratingDistribution: {
            '1': 0,
            '2': 0,
            '3': 0,
            '4': 0,
            '5': 0,
          },
        },
      });
    }

    const summary: ReviewSummary = {
      averageRating: summaryData.average_rating,
      totalReviews: summaryData.total_reviews,
      credibilityScore: summaryData.credibility_score,
      credibilityBadge: await getCredibilityBadge(summaryData.average_rating),
      recentPositivePercentage: summaryData.recent_positive_percentage,
      ratingDistribution: {
        '1': summaryData.rating_1_count,
        '2': summaryData.rating_2_count,
        '3': summaryData.rating_3_count,
        '4': summaryData.rating_4_count,
        '5': summaryData.rating_5_count,
      },
    };

    return res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Error fetching review summary:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Get reviews for an agent with pagination, sorting and filtering
 */
export const getReviews = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const { page = 1, limit = 10, sort = 'newest', rating } = req.query;
    const userId = req.user?.id;

    const offset = (Number(page) - 1) * Number(limit);

    // Query to get the reviews for the agent
    let query = supabase
      .from('reviews')
      .select(`
        *,
        users:user_id (
          id,
          name,
          avatar_url,
          is_verified,
          is_official
        )
      `)
      .eq('agent_id', agentId)
      .range(offset, offset + Number(limit) - 1);

    if (rating) {
      query = query.eq('rating', Number(rating));
    }

    if (sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (sort === 'highest') {
      query = query.order('rating', { ascending: false });
    } else if (sort === 'lowest') {
      query = query.order('rating', { ascending: true });
    }

    const { data: reviews, error } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'reviews_error',
          message: 'Error retrieving reviews'
        }
      });
    }

    // Prepare promises to fetch replies for each review
    const repliesPromises = reviews.map(review => 
      supabase
        .from('review_replies')
        .select(`
          id,
          content,
          created_at,
          updated_at,
          user_id,
          users:user_id (
            id,
            name,
            avatar_url,
            is_verified,
            is_official
          )
        `)
        .eq('review_id', review.id)
        .order('created_at', { ascending: true })
    );

    // Prepare promises to fetch vote information for each review if user is authenticated
    const votesPromises = reviews.map(review => {
      if (userId) {
        return supabase
          .from('review_votes')
          .select('vote')
          .eq('review_id', review.id)
          .eq('user_id', userId)
          .maybeSingle();
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Wait for all replies and votes to be fetched
    const [repliesResults, votesResults] = await Promise.all([
      Promise.all(repliesPromises),
      Promise.all(votesPromises)
    ]);

    // Format the reviews with their replies and vote information
    const formattedReviews: ReviewResponse[] = reviews.map((review, index) => {
      const repliesData = repliesResults[index].data || [];
      const voteData = votesResults[index].data;
      
      // Format replies - Fixed to handle users data properly
      const formattedReplies = repliesData.map(reply => {
        // Safe access to users - handle as object or array
        const userData = reply.users && typeof reply.users === 'object' ? 
          (Array.isArray(reply.users) ? 
            (reply.users.length > 0 ? reply.users[0] : null) : 
            reply.users) : 
          null;
      
        return {
          id: reply.id,
          author: {
            id: reply.user_id,
            name: userData?.name || 'User',
            avatar: userData?.avatar_url || null,
            isVerified: userData?.is_verified || false,
            isCurrentUser: reply.user_id === userId,
            isOfficial: userData?.is_official || false
          },
          date: reply.created_at,
          formattedDate: format(new Date(reply.created_at), 'PP'),
          content: reply.content
        };
      });

      // Format images
      const additionalImages = review.images ? review.images.map((img: any, imgIndex: number) => ({
        id: `${review.id}-img-${imgIndex}`,
        url: img.url || img,
        thumbnailUrl: img.thumbnailUrl || img,
        alt: img.alt || `Review image ${imgIndex + 1}`
      })) : [];

      return {
        id: review.id,
        author: {
          id: review.user_id,
          name: review.users?.name || 'User',
          avatar: review.users?.avatar_url || null,
          isVerified: review.users?.is_verified || false,
          isCurrentUser: review.user_id === userId,
          isOfficial: review.users?.is_official || false
        },
        rating: review.rating,
        date: review.created_at,
        formattedDate: format(new Date(review.created_at), 'PP'),
        content: review.content,
        replies: formattedReplies,
        replyCount: formattedReplies.length,
        helpful: {
          upvotes: review.upvotes || 0,
          downvotes: review.downvotes || 0,
          userVote: voteData ? voteData.vote : 0,
        },
        additionalImages: additionalImages,
      };
    });

    return res.status(200).json({
      success: true,
      reviews: formattedReviews,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Submit a new review
 */
export const submitReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { agentId } = req.params;
    const { rating, content, images } = req.body;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!userId || !authToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to submit a review'
        }
      });
    }

    // Validation checks
    if (!rating || !content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'missing_fields',
          message: 'Rating and content are required'
        }
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Rating must be between 1 and 5'
        }
      });
    }

    if (content.length < 10 || content.length > 2000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Content must be between 10 and 2000 characters'
        }
      });
    }

    if (images && images.length > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Maximum of 5 images allowed per review'
        }
      });
    }

    // Get authenticated client
    const authenticatedSupabase = getAuthenticatedClient(authToken);

    // Check if user has already reviewed this agent
    const { data: existingReview, error: checkError } = await authenticatedSupabase
      .from('reviews')
      .select('id')
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .single();

    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'duplicate_review',
          message: 'You have already submitted a review for this agent'
        }
      });
    }

    // Insert the review with images
    const { data: reviewData, error: insertError } = await authenticatedSupabase
      .from('reviews')
      .insert({
        agent_id: agentId,
        user_id: userId,
        rating,
        content,
        images: images || [] // Use empty array if no images provided
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error submitting review:', insertError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'submit_error',
          message: 'Error submitting review'
        }
      });
    }

    // Get user data for response
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', userId)
      .maybeSingle(); // Changed from single() to maybeSingle()

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user data:', userError);
    }

    // Format the response
    const reviewResponse = {
      id: reviewData.id,
      agent_id: reviewData.agent_id,
      rating: reviewData.rating,
      content: reviewData.content,
      replies: [],
      replyCount: 0,
      date: reviewData.created_at,
      formattedDate: format(new Date(reviewData.created_at), 'PP'),
      author: {
        id: userId,
        name: userData?.name || 'Anonymous User', // Default name if missing
        avatar: userData?.avatar_url || null,
        isVerified: false,
        isCurrentUser: true
      }
    };

    return res.status(201).json({
      success: true,
      review: reviewResponse
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Edit a review
 */
export const editReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { rating, content, images } = req.body;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!userId || !authToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to edit a review'
        }
      });
    }

    // Get authenticated client
    const authenticatedSupabase = getAuthenticatedClient(authToken);

    // Check if review exists and belongs to user
    const { data: existingReview, error: checkError } = await authenticatedSupabase
      .from('reviews')
      .select('user_id, created_at')
      .eq('id', reviewId)
      .single();

    if (checkError || !existingReview) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Review not found'
        }
      });
    }

    if (existingReview.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You can only edit your own reviews'
        }
      });
    }

    // Check if review is within 48 hour edit window
    const reviewDate = new Date(existingReview.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 48) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'edit_window_expired',
          message: 'Reviews can only be edited within 48 hours of submission'
        }
      });
    }

    // Validation checks
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Rating must be between 1 and 5'
        }
      });
    }

    if (content.length < 10 || content.length > 2000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Content must be between 10 and 2000 characters'
        }
      });
    }

    if (images && images.length > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Maximum of 5 images allowed per review'
        }
      });
    }

    // Update the review
    const { data: updatedReview, error: updateError } = await authenticatedSupabase
      .from('reviews')
      .update({
        rating,
        content,
        images: images || [], // Ensure we update with an empty array if no images provided
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating review:', updateError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'update_error',
          message: 'Error updating review'
        }
      });
    }

    return res.status(200).json({
      success: true,
      review: updatedReview
    });
  } catch (error) {
    console.error('Error in editReview:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Delete a review
 */
export const deleteReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!userId || !authToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to delete a review'
        }
      });
    }

    // Get authenticated client
    const authenticatedSupabase = getAuthenticatedClient(authToken);

    // Check if review exists and belongs to user
    const { data: existingReview, error: checkError } = await authenticatedSupabase
      .from('reviews')
      .select('user_id')
      .eq('id', reviewId)
      .single();

    if (checkError || !existingReview) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Review not found'
        }
      });
    }

    if (existingReview.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You can only delete your own reviews'
        }
      });
    }

    // Delete the review
    const { error } = await authenticatedSupabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (error) {
      console.error('Error deleting review:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'delete_error',
          message: 'Error deleting review'
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Helper function to get credibility badge based on rating
 */
async function getCredibilityBadge(avgRating: number): Promise<string> {
  if (avgRating >= 4.5) {
    return 'excellent';
  } else if (avgRating >= 3.5) {
    return 'good';
  } else if (avgRating >= 2.5) {
    return 'average';
  } else if (avgRating >= 1.5) {
    return 'poor';
  }
  return 'not-rated'; // Default fallback
}

/**
 * Get all replies for a review
 */
export const getReviewReplies = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    // First check if the review exists
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Review not found'
        }
      });
    }

    // Get the replies with user data
    const { data: replies, error: repliesError } = await supabase
      .from('review_replies')
      .select(`
        id,
        content,
        created_at,
        updated_at,
        user_id,
        users:user_id (
          name,
          avatar_url,
          is_verified,
          is_official
        )
      `)
      .eq('review_id', reviewId)
      .order('created_at', { ascending: true })
      .range(offset, offset + Number(limit) - 1);

    if (repliesError) {
      console.error('Error fetching review replies:', repliesError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'replies_error',
          message: 'Error retrieving review replies'
        }
      });
    }

    // Format the replies for response
    const formattedReplies = replies.map(reply => {
      const userData = reply.users && typeof reply.users === 'object' ? 
        (Array.isArray(reply.users) ? 
          (reply.users.length > 0 ? reply.users[0] : null) : 
          reply.users) : 
        null;
    
      return {
        id: reply.id,
        author: {
          id: reply.user_id,
          name: userData?.name || 'User',
          avatar: userData?.avatar_url || null,
          isVerified: userData?.is_verified || false,
          isCurrentUser: reply.user_id === (req as AuthenticatedRequest).user?.id,
          isOfficial: userData?.is_official || false
        },
        date: reply.created_at,
        formattedDate: format(new Date(reply.created_at), 'PP'),
        content: reply.content
      };
    });

    return res.status(200).json({
      success: true,
      replies: formattedReplies
    });
  } catch (error) {
    console.error('Error in getReviewReplies:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Create a new reply to a review
 */
export const addReviewReply = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.split(' ')[1]; // Extract token from Authorization header

    if (!userId || !authToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to reply to a review'
        }
      });
    }

    // Validation checks
    if (!content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'missing_fields',
          message: 'Content is required'
        }
      });
    }

    if (content.length < 10 || content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Content must be between 10 and 1000 characters'
        }
      });
    }

    // Get authenticated client
    const authenticatedSupabase = getAuthenticatedClient(authToken);

    // Check if the review exists
    const { data: review, error: reviewError } = await authenticatedSupabase
      .from('reviews')
      .select('id')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Review not found'
        }
      });
    }

    // Insert the reply with authenticated client
    const { data: replyData, error: insertError } = await authenticatedSupabase
      .from('review_replies')
      .insert({
        review_id: reviewId,
        user_id: userId,
        content
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating reply:', insertError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'insert_error',
          message: 'Error creating reply'
        }
      });
    }

    // Get user data for response
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('name, avatar_url, is_verified, is_official')
      .eq('id', userId)
      .maybeSingle(); // Changed from single() to maybeSingle()

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user data:', userError);
    }

    // Format the response
    const replyResponse = {
      id: replyData.id,
      author: {
        id: userId,
        name: userData?.name || 'Anonymous User', // Default name if missing
        avatar: userData?.avatar_url || null,
        isVerified: userData?.is_verified || false,
        isCurrentUser: true,
        isOfficial: userData?.is_official || false
      },
      date: replyData.created_at,
      formattedDate: format(new Date(replyData.created_at), 'PP'),
      content: replyData.content
    };

    return res.status(201).json({
      success: true,
      reply: replyResponse
    });
  } catch (error) {
    console.error('Error in addReviewReply:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Update a review reply
 */
export const updateReviewReply = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { replyId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!userId || !authToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to update a reply'
        }
      });
    }

    // Get authenticated client
    const authenticatedSupabase = getAuthenticatedClient(authToken);

    // Validation checks
    if (!content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'missing_fields',
          message: 'Content is required'
        }
      });
    }

    if (content.length < 10 || content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Content must be between 10 and 1000 characters'
        }
      });
    }

    // Check if the reply exists and belongs to the user
    const { data: reply, error: replyError } = await authenticatedSupabase
      .from('review_replies')
      .select('user_id, created_at')
      .eq('id', replyId)
      .single();

    if (replyError || !reply) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Reply not found'
        }
      });
    }

    if (reply.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You can only update your own replies'
        }
      });
    }

    // Check if reply is within 24 hour edit window
    const replyDate = new Date(reply.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - replyDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'edit_window_expired',
          message: 'Replies can only be edited within 24 hours of submission'
        }
      });
    }

    // Update the reply
    const { data: updatedReply, error: updateError } = await authenticatedSupabase
      .from('review_replies')
      .update({
        content,
        updated_at: new Date().toISOString()
      })
      .eq('id', replyId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating reply:', updateError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'update_error',
          message: 'Error updating reply'
        }
      });
    }

    // Get user data for response
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('name, avatar_url, is_verified, is_official')
      .eq('id', userId)
      .maybeSingle(); // Changed from single() to maybeSingle()

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user data:', userError);
    }

    // Format the response
    const replyResponse = {
      id: updatedReply.id,
      author: {
        id: userId,
        name: userData?.name || 'Anonymous User', // Default name if missing
        avatar: userData?.avatar_url || null,
        isVerified: userData?.is_verified || false,
        isCurrentUser: true,
        isOfficial: userData?.is_official || false
      },
      date: updatedReply.created_at,
      formattedDate: format(new Date(updatedReply.created_at), 'PP'),
      content: updatedReply.content
    };

    return res.status(200).json({
      success: true,
      reply: replyResponse
    });
  } catch (error) {
    console.error('Error in updateReviewReply:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Delete a review reply
 */
export const deleteReviewReply = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { replyId } = req.params;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!userId || !authToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to delete a reply'
        }
      });
    }

    // Get authenticated client
    const authenticatedSupabase = getAuthenticatedClient(authToken);

    // Check if the reply exists and belongs to the user
    const { data: reply, error: replyError } = await authenticatedSupabase
      .from('review_replies')
      .select('user_id')
      .eq('id', replyId)
      .single();

    if (replyError || !reply) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Reply not found'
        }
      });
    }

    if (reply.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You can only delete your own replies'
        }
      });
    }

    // Delete the reply
    const { error: deleteError } = await authenticatedSupabase
      .from('review_replies')
      .delete()
      .eq('id', replyId);

    if (deleteError) {
      console.error('Error deleting reply:', deleteError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'delete_error',
          message: 'Error deleting reply'
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reply deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteReviewReply:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Vote on a review (upvote, downvote, or remove vote)
 */
export const voteOnReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { vote } = req.body;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!userId || !authToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to vote on a review'
        }
      });
    }

    // Get authenticated client
    const authenticatedSupabase = getAuthenticatedClient(authToken);

    // Validation checks
    if (vote !== 1 && vote !== -1 && vote !== 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Vote must be 1 (upvote), -1 (downvote), or 0 (remove vote)'
        }
      });
    }

    // Check if the review exists
    const { data: review, error: reviewError } = await authenticatedSupabase
      .from('reviews')
      .select('id')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Review not found'
        }
      });
    }

    // Check if user already voted
    const { data: existingVote, error: voteCheckError } = await authenticatedSupabase
      .from('review_votes')
      .select('id, vote')
      .eq('review_id', reviewId)
      .eq('user_id', userId)
      .maybeSingle();

    // Handle vote operations with authenticated client
    if (existingVote) {
      if (vote === 0) {
        // Remove vote
        const { error: deleteError } = await authenticatedSupabase
          .from('review_votes')
          .delete()
          .eq('id', existingVote.id);
          
        if (deleteError) {
          console.error('Error removing vote:', deleteError);
          return res.status(500).json({
            success: false,
            error: {
              code: 'delete_error',
              message: 'Error removing vote'
            }
          });
        }
      } else if (existingVote.vote !== vote) {
        // Update vote
        const { error: updateError } = await authenticatedSupabase
          .from('review_votes')
          .update({ vote, updated_at: new Date().toISOString() })
          .eq('id', existingVote.id);
          
        if (updateError) {
          console.error('Error updating vote:', updateError);
          return res.status(500).json({
            success: false,
            error: {
              code: 'update_error',
              message: 'Error updating vote'
            }
          });
        }
      } else {
        // Vote is the same, no action needed
      }
    } else if (vote !== 0) {
      // Create new vote
      const { error: insertError } = await authenticatedSupabase
        .from('review_votes')
        .insert({
          review_id: reviewId,
          user_id: userId,
          vote
        });
        
      if (insertError) {
        console.error('Error creating vote:', insertError);
        return res.status(500).json({
          success: false,
          error: {
            code: 'insert_error',
            message: 'Error creating vote'
          }
        });
      }
    }

    // Get updated vote counts
    const { data: voteStats, error: statsError } = await authenticatedSupabase
      .from('reviews')
      .select('upvotes, downvotes')
      .eq('id', reviewId)
      .single();

    if (statsError) {
      console.error('Error fetching vote stats:', statsError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'stats_error',
          message: 'Error retrieving vote statistics'
        }
      });
    }

    return res.status(200).json({
      success: true,
      vote: {
        reviewId,
        userVote: vote,
        upvotes: voteStats.upvotes || 0,
        downvotes: voteStats.downvotes || 0
      }
    });
  } catch (error) {
    console.error('Error in voteOnReview:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * Get votes for a review
 */
export const getReviewVotes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.id;

    // Check if the review exists
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id, upvotes, downvotes')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Review not found'
        }
      });
    }

    // Get user's vote if authenticated
    let userVote = 0;
    if (userId) {
      const { data: voteData, error: voteError } = await supabase
        .from('review_votes')
        .select('vote')
        .eq('review_id', reviewId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!voteError && voteData) {
        userVote = voteData.vote;
      }
    }

    return res.status(200).json({
      success: true,
      votes: {
        upvotes: review.upvotes || 0,
        downvotes: review.downvotes || 0,
        userVote
      }
    });
  } catch (error) {
    console.error('Error in getReviewVotes:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};