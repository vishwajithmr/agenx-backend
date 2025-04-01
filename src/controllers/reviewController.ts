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
    const { page = 1, limit = 10, sort = 'newest' } = req.query;

    // Fetch reviews logic
    // ...existing code...

    return res.status(200).json({
      success: true,
      reviews,
      pagination,
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
    
    // Validate input
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
    
    // Check if user has already reviewed this agent
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
    
    // Begin transaction to insert review and images
    // Supabase doesn't support transactions via API, so we'll do sequential operations
    
    // Insert the review
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
    
    // Process and upload images if any
    const uploadedImages = [];
    if (images && images.length > 0) {
      for (const imageData of images) {
        // For simplicity, assuming imageData is already a URL
        // In a real app, you'd process base64 data and upload to storage
        
        const { data: imageRecord, error: imageError } = await supabase
          .from('review_images')
          .insert({
            review_id: reviewData.id,
            url: imageData,
            thumbnail_url: imageData, // In real app, generate thumbnail
            alt_text: 'Review image',
          })
          .select()
          .single();
        
        if (imageError) {
          console.error('Error uploading image:', imageError);
          // Continue with other images even if one fails
          continue;
        }
        
        uploadedImages.push({
          id: imageRecord.id,
          url: imageRecord.url,
          thumbnailUrl: imageRecord.thumbnail_url,
          alt: imageRecord.alt_text,
        });
      }
    }
    
    // Get user data to complete the response
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.error('Error fetching user data:', userError);
      // Continue anyway since the review is already created
    }
    
    // Format response
    const reviewResponse: ReviewResponse = {
      id: reviewData.id,
      author: {
        id: userData?.id || userId,
        name: userData?.name || 'User',
        avatar: userData?.avatar_url,
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
 * Reply to a review
 */
export const replyToReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to reply to a review',
        },
      });
    }
    
    // Validate input
    if (!content || content.length < 10 || content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Reply content must be between 10 and 1000 characters',
        },
      });
    }
    
    // Check if review exists
    const { data: reviewData, error: reviewError } = await supabase
      .from('reviews')
      .select('id, user_id, agent_id')
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
    
    // Check if user has already replied to this review
    // Skip this check for agent owners (would need to check if user owns the agent)
    const { data: existingReply, error: existingError } = await supabase
      .from('review_replies')
      .select('id')
      .eq('review_id', reviewId)
      .eq('user_id', userId)
      .single();
    
    if (existingReply && userId !== reviewData.user_id) {
      // Allow review author to reply multiple times
      // In a real app, you'd also check if the user is the agent owner
      return res.status(400).json({
        success: false,
        error: {
          code: 'already_replied',
          message: 'You have already replied to this review',
        },
      });
    }
    
    // Insert the reply
    const { data: replyData, error: replyError } = await supabase
      .from('review_replies')
      .insert({
        review_id: reviewId,
        user_id: userId,
        content,
      })
      .select()
      .single();
    
    if (replyError) {
      console.error('Error creating reply:', replyError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error creating reply',
        },
      });
    }
    
    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.error('Error fetching user data:', userError);
    }
    
    // Check if user is the agent owner
    // In a real app, you'd check if the user owns the agent
    const isOfficial = false; // Placeholder for real logic
    
    return res.status(201).json({
      success: true,
      reviewId,
      reply: {
        id: replyData.id,
        author: {
          id: userData?.id || userId,
          name: userData?.name || 'User',
          avatar: userData?.avatar_url,
          isVerified: true,
          isCurrentUser: true,
          isOfficial,
        },
        date: replyData.created_at,
        formattedDate: format(new Date(replyData.created_at), 'MMM d, yyyy'),
        content: replyData.content,
      },
    });
  } catch (error) {
    console.error('Error in replyToReview:', error);
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
 * Vote on a review
 */
export const voteReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { vote } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to vote on a review',
        },
      });
    }
    
    // Validate input
    if (vote !== -1 && vote !== 0 && vote !== 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Vote must be -1, 0, or 1',
        },
      });
    }
    
    // Check if review exists and user is not the author
    const { data: reviewData, error: reviewError } = await supabase
      .from('reviews')
      .select('id, user_id')
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
    
    if (reviewData.user_id === userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'self_vote',
          message: 'You cannot vote on your own review',
        },
      });
    }
    
    // Check if user has already voted
    const { data: existingVote, error: existingError } = await supabase
      .from('review_votes')
      .select('id, vote')
      .eq('review_id', reviewId)
      .eq('user_id', userId)
      .single();
    
    if (existingVote) {
      // Update existing vote
      if (vote === 0) {
        // Delete the vote if setting to 0
        const { error: deleteError } = await supabase
          .from('review_votes')
          .delete()
          .eq('id', existingVote.id);
        
        if (deleteError) {
          console.error('Error deleting vote:', deleteError);
          return res.status(500).json({
            success: false,
            error: {
              code: 'database_error',
              message: 'Error updating vote',
            },
          });
        }
      } else if (existingVote.vote !== vote) {
        // Update the vote if it's different
        const { error: updateError } = await supabase
          .from('review_votes')
          .update({ vote })
          .eq('id', existingVote.id);
        
        if (updateError) {
          console.error('Error updating vote:', updateError);
          return res.status(500).json({
            success: false,
            error: {
              code: 'database_error',
              message: 'Error updating vote',
            },
          });
        }
      }
    } else if (vote !== 0) {
      // Create new vote if not setting to 0
      const { error: insertError } = await supabase
        .from('review_votes')
        .insert({
          review_id: reviewId,
          user_id: userId,
          vote,
        });
      
      if (insertError) {
        console.error('Error creating vote:', insertError);
        return res.status(500).json({
          success: false,
          error: {
            code: 'database_error',
            message: 'Error creating vote',
          },
        });
      }
    }
    
    // Get updated vote counts
    const { data: votesData, error: votesError } = await supabase
      .from('review_votes')
      .select('vote')
      .eq('review_id', reviewId);
    
    if (votesError) {
      console.error('Error fetching votes:', votesError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error fetching votes',
        },
      });
    }
    
    const upvotes = votesData.filter(v => v.vote === 1).length;
    const downvotes = votesData.filter(v => v.vote === -1).length;
    
    return res.status(200).json({
      success: true,
      reviewId,
      helpful: {
        upvotes,
        downvotes,
        userVote: vote,
      },
    });
  } catch (error) {
    console.error('Error in voteReview:', error);
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
    
    // Check if review exists and user is the author
    const { data: reviewData, error: reviewError } = await supabase
      .from('reviews')
      .select('id, user_id')
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
      // In a real app, you'd also check if the user is an admin
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You are not authorized to delete this review',
        },
      });
    }
    
    // Delete the review (cascading delete will handle related records)
    const { error: deleteError } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);
    
    if (deleteError) {
      console.error('Error deleting review:', deleteError);
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
      message: 'Review successfully deleted',
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
 * Delete a reply
 */
export const deleteReply = async (req: Request, res: Response) => {
  try {
    const { replyId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to delete a reply',
        },
      });
    }
    
    // Check if reply exists and user is the author
    const { data: replyData, error: replyError } = await supabase
      .from('review_replies')
      .select('id, user_id')
      .eq('id', replyId)
      .single();
    
    if (replyError || !replyData) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'not_found',
          message: 'Reply not found',
        },
      });
    }
    
    if (replyData.user_id !== userId) {
      // In a real app, you'd also check if the user is an admin
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You are not authorized to delete this reply',
        },
      });
    }
    
    // Delete the reply
    const { error: deleteError } = await supabase
      .from('review_replies')
      .delete()
      .eq('id', replyId);
    
    if (deleteError) {
      console.error('Error deleting reply:', deleteError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error deleting reply',
        },
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Reply successfully deleted',
    });
  } catch (error) {
    console.error('Error in deleteReply:', error);
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
    
    // Validate input
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
    
    // Check if review exists and user is the author
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
    
    // Check if review is within 48 hours
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
    
    // Update the review
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
    
    // Handle images if provided
    if (images) {
      // Delete existing images
      const { error: deleteImagesError } = await supabase
        .from('review_images')
        .delete()
        .eq('review_id', reviewId);
      
      if (deleteImagesError) {
        console.error('Error deleting existing images:', deleteImagesError);
      }
      
      // Upload new images
      const uploadedImages = [];
      for (const imageData of images) {
        // For simplicity, assuming imageData is already a URL
        const { data: imageRecord, error: imageError } = await supabase
          .from('review_images')
          .insert({
            review_id: reviewId,
            url: imageData,
            thumbnail_url: imageData, // In real app, generate thumbnail
            alt_text: 'Review image',
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
          alt: imageRecord.alt_text,
        });
      }
    }
    
    // Fetch complete review data for response
    const { data: completeReview, error: fetchError } = await supabase
      .from('reviews')
      .select(`
        id, rating, content, created_at, updated_at,
        users:user_id (id, name, avatar_url),
        images:review_images (id, url, thumbnail_url, alt_text),
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
    
    // Format response
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
          isOfficial: false, // Set based on your business logic
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
        alt: image.alt_text,
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
 * Helper function to get credibility badge based on rating
 */
async function getCredibilityBadge(avgRating: number): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_credibility_badge', {
      avg_rating: avgRating,
    });
    
    if (error) {
      console.error('Error getting credibility badge:', error);
      // Fallback if RPC fails
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
    // Fallback
    if (avgRating >= 4.5) return 'outstanding';
    if (avgRating >= 4.0) return 'excellent';
    if (avgRating >= 3.5) return 'good';
    if (avgRating >= 3.0) return 'fair';
    if (avgRating > 0) return 'poor';
    return 'not-rated';
  }
}
