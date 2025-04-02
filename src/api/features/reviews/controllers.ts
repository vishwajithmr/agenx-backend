import { Request, Response } from 'express';
import { format } from 'date-fns';
import { supabase } from '../../../db/config/supabase';
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

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('reviews')
      .select('*')
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

    const formattedReviews: ReviewResponse[] = reviews.map((review) => ({
      id: review.id,
      author: {
        id: review.user_id,
        name: review.user_name,
        avatar: review.user_avatar,
        isVerified: review.user_is_verified,
        isCurrentUser: review.user_id === req.user?.id,
        isOfficial: review.user_is_official,
      },
      rating: review.rating,
      date: review.created_at,
      formattedDate: format(new Date(review.created_at), 'PP'),
      content: review.content,
      replies: review.replies || [],
      replyCount: review.reply_count || 0,
      helpful: {
        upvotes: review.upvotes || 0,
        downvotes: review.downvotes || 0,
        userVote: review.user_vote || 0,
      },
      additionalImages: review.additional_images || [],
    }));

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

    console.log('Authenticated user ID:', userId); // Debugging log

    // Validation checks
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to submit a review'
        }
      });
    }

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

    // Check if user has already reviewed this agent
    const { data: existingReview, error: checkError } = await supabase
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
    const { data: reviewData, error: insertError } = await supabase
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
      .single();

    if (userError) {
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
        name: userData?.name || 'User',
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

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to edit a review'
        }
      });
    }

    // Check if review exists and belongs to user
    const { data: existingReview, error: checkError } = await supabase
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
    const { data: updatedReview, error: updateError } = await supabase
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

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to delete a review'
        }
      });
    }

    // Check if review exists and belongs to user
    const { data: existingReview, error: checkError } = await supabase
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
    const { error } = await supabase
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