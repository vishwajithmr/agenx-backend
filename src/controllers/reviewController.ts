import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  ApiResponse, Review, ReviewImage, ReviewSummary, ReviewResponse, 
  ReviewReply, ReviewVote, PaginationResponse, ReviewQueryParams
} from '../types';
import { format } from 'date-fns';
import { supabase } from '../config/supabase';

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
      .single();

    if (summaryError) {
      console.error('Error fetching review summary:', summaryError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error fetching review summary',
        },
      });
    }

    // If no summary found, return empty summary
    const summary: ReviewSummary = summaryData ? {
      averageRating: parseFloat(summaryData.average_rating) || 0,
      totalReviews: summaryData.total_reviews || 0,
      credibilityScore: parseFloat(summaryData.average_rating) || 0,
      credibilityBadge: await getCredibilityBadge(parseFloat(summaryData.average_rating) || 0),
      recentPositivePercentage: summaryData.recent_positive_percentage || 0,
      ratingDistribution: {
        '1': summaryData.rating_1 || 0,
        '2': summaryData.rating_2 || 0,
        '3': summaryData.rating_3 || 0,
        '4': summaryData.rating_4 || 0,
        '5': summaryData.rating_5 || 0,
      },
    } : {
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
    };

    return res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Error in getReviewSummary:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred',
      },
    });
  }
};

/**
 * Get reviews for an agent with pagination, sorting and filtering
 */
export const getReviews = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sort = req.query.sort as string || 'newest';
    const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Build query - Fix the review_votes selection by explicitly selecting only needed fields
    let query = supabase
      .from('reviews')
      .select(`
        *,
        users:user_id (*), 
        images:review_images (id, url, thumbnail_url),
        replies:review_replies (
          id, content, created_at,
          user:user_id (*)
        ),
        votes:review_votes (user_id, vote)
      `, { count: 'exact' })
      .eq('agent_id', agentId);
    
    // Add rating filter if provided
    if (rating !== undefined) {
      query = query.eq('rating', rating);
    }
    
    // Add sorting
    switch (sort) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'highest':
        query = query.order('rating', { ascending: false });
        break;
      case 'lowest':
        query = query.order('rating', { ascending: true });
        break;
      case 'most_helpful':
        query = query.order('upvotes', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }
    
    // Add pagination
    query = query.range(offset, offset + limit - 1);
    
    // Execute query
    const { data: reviews, error, count } = await query;
    
    if (error) {
      console.error('Error fetching reviews:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error fetching reviews',
        },
      });
    }
    
    // Get current user ID if authenticated
    const userId = req.user?.id;
    
    // Format reviews for response - Update to handle missing alt_text
    const formattedReviews = reviews.map(review => {
      const upvotes = review.votes?.filter(v => v.vote === 1).length || 0;
      const downvotes = review.votes?.filter(v => v.vote === -1).length || 0;
      const userVote = userId ? review.votes?.find(v => v.user_id === userId)?.vote || 0 : 0;
      
      return {
        id: review.id,
        author: {
          id: review.users?.id,
          name: review.users?.name,
          avatar: review.users?.avatar_url,
          isVerified: true,
          isCurrentUser: review.users?.id === userId,
        },
        rating: review.rating,
        date: review.created_at,
        formattedDate: format(new Date(review.created_at), 'MMM d, yyyy'),
        content: review.content,
        replies: (review.replies || []).map(reply => ({
          id: reply.id,
          author: {
            id: reply.user?.id,
            name: reply.user?.name,
            avatar: reply.user?.avatar_url,
            isVerified: true,
            isCurrentUser: reply.user?.id === userId,
          },
          date: reply.created_at,
          formattedDate: format(new Date(reply.created_at), 'MMM d, yyyy'),
          content: reply.content,
        })),
        replyCount: review.replies?.length || 0,
        helpful: {
          upvotes,
          downvotes,
          userVote,
        },
        additionalImages: (review.images || []).map(image => ({
          id: image.id,
          url: image.url,
          thumbnailUrl: image.thumbnail_url,
          alt: '', // Use empty string as default since alt_text might not exist
        })),
      };
    });
    
    return res.status(200).json({
      success: true,
      reviews: formattedReviews,
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error in getReviews:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred',
      },
    });
  }
};

/**
 * Submit a new review
 */
export const submitReview = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { rating, content, images } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to submit a review',
        },
      });
    }
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Rating must be between 1 and 5',
        },
      });
    }
    
    if (!content || content.length < 10 || content.length > 2000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Review content must be between 10 and 2000 characters',
        },
      });
    }
    
    if (images && images.length > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Maximum of 5 images allowed per review',
        },
      });
    }
    
    const { data: existingReview, error: existingError } = await supabase
      .from('reviews')
      .select('id')
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .single();
    
    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'already_reviewed',
          message: 'You have already submitted a review for this agent',
        },
      });
    }
    
    const { data: reviewData, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        agent_id: agentId,
        user_id: userId,
        rating,
        content,
      })
      .select()
      .single();
    
    if (reviewError) {
      console.error('Error creating review:', reviewError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error creating review',
        },
      });
    }
    
    const uploadedImages = [];
    if (images && images.length > 0) {
      for (const imageData of images) {
        const { data: imageRecord, error: imageError } = await supabase
          .from('review_images')
          .insert({
            review_id: reviewData.id,
            url: imageData,
            thumbnail_url: imageData,
          })
          .select()
          .single();
        
        if (imageError) {
          console.error('Error uploading image:', imageError);
          continue;
        }
        
        uploadedImages.push({
          id: imageRecord.id,
          url: imageRecord.url,
          thumbnailUrl: imageRecord.thumbnail_url,
          alt: '', // Use empty string as default
        });
      }
    }
    
    // Get user data - Remove single() to handle missing profiles
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .eq('id', userId);
    
    let userData = null;
    
    if (userError) {
      console.error('Error fetching user data:', userError);
    } else if (users && users.length > 0) {
      userData = users[0];
    }
    
    // If no user profile found, get basic data from auth user
    if (!userData) {
      // Get email from auth user
      const { data: authUser } = await supabase.auth.getUser();
      userData = {
        id: userId,
        name: authUser?.user?.email?.split('@')[0] || 'User',
        avatar_url: null
      };
      
      // Try to create a basic profile
      try {
        await supabase
          .from('users')
          .insert({
            id: userId,
            email: authUser?.user?.email || 'user@example.com',
            name: userData.name
          });
      } catch (insertError) {
        console.error('Error creating user profile:', insertError);
      }
    }
    
    const reviewResponse: ReviewResponse = {
      id: reviewData.id,
      author: {
        id: userData.id,
        name: userData.name,
        avatar: userData.avatar_url,
        isVerified: true,
        isCurrentUser: true,
      },
      rating: reviewData.rating,
      date: reviewData.created_at,
      formattedDate: format(new Date(reviewData.created_at), 'MMM d, yyyy'),
      content: reviewData.content,
      replies: [],
      replyCount: 0,
      helpful: {
        upvotes: 0,
        downvotes: 0,
        userVote: 0,
      },
      additionalImages: uploadedImages,
    };
    
    return res.status(201).json({
      success: true,
      review: reviewResponse,
    });
  } catch (error) {
    console.error('Error in submitReview:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred',
      },
    });
  }
};

/**
 * Edit a review
 */
export const editReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { rating, content, images } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to edit a review',
        },
      });
    }
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Rating must be between 1 and 5',
        },
      });
    }
    
    if (!content || content.length < 10 || content.length > 2000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Review content must be between 10 and 2000 characters',
        },
      });
    }
    
    if (images && images.length > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Maximum of 5 images allowed per review',
        },
      });
    }
    
    const { data: reviewData, error: reviewError } = await supabase
      .from('reviews')
      .select('id, user_id, created_at')
      .eq('id', reviewId)
      .single();
    
    if (reviewError || !reviewData) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Review not found',
        },
      });
    }
    
    if (reviewData.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You are not authorized to edit this review',
        },
      });
    }
    
    const reviewDate = new Date(reviewData.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > 48) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'edit_window_expired',
          message: 'Reviews can only be edited within 48 hours of submission',
        },
      });
    }
    
    const { data: updatedReview, error: updateError } = await supabase
      .from('reviews')
      .update({
        rating,
        content,
      })
      .eq('id', reviewId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating review:', updateError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error updating review',
        },
      });
    }
    
    if (images) {
      const { error: deleteImagesError } = await supabase
        .from('review_images')
        .delete()
        .eq('review_id', reviewId);
      
      if (deleteImagesError) {
        console.error('Error deleting existing images:', deleteImagesError);
      }
      
      const uploadedImages = [];
      for (const imageData of images) {
        const { data: imageRecord, error: imageError } = await supabase
          .from('review_images')
          .insert({
            review_id: reviewId,
            url: imageData,
            thumbnail_url: imageData,
          })
          .select()
          .single();
        
        if (imageError) {
          console.error('Error uploading image:', imageError);
          continue;
        }
        
        uploadedImages.push({
          id: imageRecord.id,
          url: imageRecord.url,
          thumbnailUrl: imageRecord.thumbnail_url,
          alt: '', // Use empty string as default
        });
      }
    }
    
    const { data: completeReview, error: fetchError } = await supabase
      .from('reviews')
      .select(`
        id, rating, content, created_at, updated_at,
        users:user_id (id, name, avatar_url),
        images:review_images (id, url, thumbnail_url),
        replies:review_replies (
          id, content, created_at,
          users:user_id (id, name, avatar_url)
        ),
        votes:review_votes (id, user_id, vote)
      `)
      .eq('id', reviewId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching updated review:', fetchError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error fetching updated review',
        },
      });
    }
    
    const upvotes = completeReview.votes?.filter(v => v.vote === 1).length || 0;
    const downvotes = completeReview.votes?.filter(v => v.vote === -1).length || 0;
    const userVote = completeReview.votes?.find(v => v.user_id === userId)?.vote || 0;
    
    const reviewResponse: ReviewResponse = {
      id: completeReview.id,
      author: {
        id: completeReview.users.id,
        name: completeReview.users.name,
        avatar: completeReview.users.avatar_url,
        isVerified: true,
        isCurrentUser: true,
      },
      rating: completeReview.rating,
      date: completeReview.created_at,
      formattedDate: format(new Date(completeReview.created_at), 'MMM d, yyyy'),
      content: completeReview.content,
      replies: (completeReview.replies || []).map((reply) => ({
        id: reply.id,
        author: {
          id: reply.users.id,
          name: reply.users.name,
          avatar: reply.users.avatar_url,
          isVerified: true,
          isCurrentUser: reply.users.id === userId,
          isOfficial: false,
        },
        date: reply.created_at,
        formattedDate: format(new Date(reply.created_at), 'MMM d, yyyy'),
        content: reply.content,
      })),
      replyCount: completeReview.replies?.length || 0,
      helpful: {
        upvotes,
        downvotes,
        userVote,
      },
      additionalImages: (completeReview.images || []).map((image) => ({
        id: image.id,
        url: image.url,
        thumbnailUrl: image.thumbnail_url,
        alt: '', // Use empty string as default
      })),
    };
    
    return res.status(200).json({
      success: true,
      review: reviewResponse,
    });
  } catch (error) {
    console.error('Error in editReview:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred',
      },
    });
  }
};

/**
 * Delete a review
 */
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to delete a review',
        },
      });
    }
    
    // Check if review exists and if the user is the author
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();
    
    if (reviewError || !review) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Review not found',
        },
      });
    }
    
    if (review.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You are not authorized to delete this review',
        },
      });
    }
    
    // Delete review images first (they will be cascade deleted by Supabase,
    // but we'll explicitly delete them to ensure clean up)
    const { error: deleteImagesError } = await supabase
      .from('review_images')
      .delete()
      .eq('review_id', reviewId);
    
    if (deleteImagesError) {
      console.error('Error deleting review images:', deleteImagesError);
      // Continue with deletion even if image deletion fails
    }
    
    // Delete review votes
    const { error: deleteVotesError } = await supabase
      .from('review_votes')
      .delete()
      .eq('review_id', reviewId);
    
    if (deleteVotesError) {
      console.error('Error deleting review votes:', deleteVotesError);
      // Continue with deletion even if votes deletion fails
    }
    
    // Delete review replies
    const { error: deleteRepliesError } = await supabase
      .from('review_replies')
      .delete()
      .eq('review_id', reviewId);
    
    if (deleteRepliesError) {
      console.error('Error deleting review replies:', deleteRepliesError);
      // Continue with deletion even if replies deletion fails
    }
    
    // Delete the review
    const { error: deleteReviewError } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);
    
    if (deleteReviewError) {
      console.error('Error deleting review:', deleteReviewError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error deleting review',
        },
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteReview:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred',
      },
    });
  }
};

/**
 * Helper function to get credibility badge based on rating
 */
async function getCredibilityBadge(avgRating: number): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_credibility_badge', {
      avg_rating: avgRating,
    });
    
    if (error) {
      console.error('Error getting credibility badge:', error);
      if (avgRating >= 4.5) return 'outstanding';
      if (avgRating >= 4.0) return 'excellent';
      if (avgRating >= 3.5) return 'good';
      if (avgRating >= 3.0) return 'fair';
      if (avgRating > 0) return 'poor';
      return 'not-rated';
    }
    
    return data;
  } catch (error) {
    console.error('Error in getCredibilityBadge:', error);
    if (avgRating >= 4.5) return 'outstanding';
    if (avgRating >= 4.0) return 'excellent';
    if (avgRating >= 3.5) return 'good';
    if (avgRating >= 3.0) return 'fair';
    if (avgRating > 0) return 'poor';
    return 'not-rated';
  }
}
