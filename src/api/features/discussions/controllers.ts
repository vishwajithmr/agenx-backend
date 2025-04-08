import { Request, Response } from 'express';
import { format } from 'date-fns';
import { 
  AuthenticatedRequest, 
  VoteRequest, 
  CommentResponse, 
  UpdateCommentRequest,
  DiscussionResponse,
  CreateDiscussionRequest,
  UpdateDiscussionRequest,
  DiscussionDetailResponse
} from '../../../shared/types';
import { supabase } from '../../../db/config/supabase';
import { getAuthenticatedClient } from '../../../db/config/supabase';

/**
 * Get discussions with pagination and filtering
 */
export const getDiscussions = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, sort = 'latest', search, agentId } = req.query;
    const userId = (req as AuthenticatedRequest).user?.id;
    
    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'missing_parameter',
          message: 'Agent ID is required'
        }
      });
    }

    const offset = (Number(page) - 1) * Number(limit);
    
    // Build the base query
    let query = supabase
      .from('discussions')
      .select(`
        *,
        users:author_id (
          id,
          name,
          avatar_url,
          is_verified,
          is_official
        ),
        comment_count
      `)
      .eq('agent_id', agentId);
    
    // Add search filter if provided
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }
    
    // Add sorting
    if (sort === 'latest') {
      query = query.order('last_activity_at', { ascending: false });
    } else if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (sort === 'top') {
      query = query.order('score', { ascending: false });
    }
    
    // Add pagination
    query = query.range(offset, offset + Number(limit) - 1);
    
    // Execute the query
    const { data: discussions, error, count } = await query;
    
    if (error) {
      console.error('Error fetching discussions:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'discussions_error',
          message: 'Error retrieving discussions'
        }
      });
    }
    
    // Get the total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('discussions')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId);
      
    if (countError) {
      console.error('Error counting discussions:', countError);
    }
    
    // Prepare promises to fetch user votes if user is authenticated
    const votesPromises = discussions.map(discussion => {
      if (userId) {
        return supabase
          .from('votes')
          .select('value')
          .eq('target_id', discussion.id)
          .eq('user_id', userId)
          .eq('target_type', 'discussion')
          .maybeSingle();
      }
      return Promise.resolve({ data: null, error: null });
    });
    
    // Wait for all votes to be fetched
    const votesResults = await Promise.all(votesPromises);
    
    // Format the discussions
    const formattedDiscussions = discussions.map((discussion, index) => {
      const voteData = votesResults[index].data;
      
      return {
        id: discussion.id,
        title: discussion.title,
        content: discussion.content,
        author: {
          id: discussion.author_id,
          name: discussion.users?.name || 'User',
          avatar: discussion.users?.avatar_url || null,
          isVerified: discussion.users?.is_verified || false,
          isOP: discussion.author_id === userId,
          isOfficial: discussion.users?.is_official || false
        },
        score: discussion.score || 0,
        userVote: voteData ? voteData.value : 0,
        timestamp: new Date(discussion.created_at).getTime(),
        formattedDate: format(new Date(discussion.created_at), 'PP'),
        isPinned: discussion.is_pinned || false,
        commentCount: discussion.comment_count || 0,
        agentId: discussion.agent_id
      };
    });
    
    return res.status(200).json({
      success: true,
      discussions: formattedDiscussions,
      pagination: {
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / Number(limit)),
        current: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching discussions:', error);
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
 * Get a specific discussion with its comments
 */
export const getDiscussion = async (req: Request, res: Response) => {
  try {
    const { discussionId } = req.params;
    const { 
      commentPage = 1, 
      commentLimit = 20, 
      commentSort = 'top' 
    } = req.query;
    const userId = (req as AuthenticatedRequest).user?.id;
    
    // Check if the discussion exists
    const { data: discussion, error } = await supabase
      .from('discussions')
      .select(`
        *,
        users:author_id (
          id,
          name,
          avatar_url,
          is_verified,
          is_official
        )
      `)
      .eq('id', discussionId)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'not_found',
            message: 'Discussion not found'
          }
        });
      }
      console.error('Error fetching discussion:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error retrieving discussion'
        }
      });
    }
    
    // Get user's vote on this discussion if authenticated
    let userVote = 0;
    if (userId) {
      const { data: voteData, error: voteError } = await supabase
        .from('votes')
        .select('value')
        .eq('target_id', discussionId)
        .eq('user_id', userId)
        .eq('target_type', 'discussion')
        .maybeSingle();
        
      if (!voteError && voteData) {
        userVote = voteData.value;
      }
    }
    
    // Get comments for this discussion
    const offset = (Number(commentPage) - 1) * Number(commentLimit);
    
    let commentsQuery = supabase
      .from('comments')
      .select(`
        *,
        users:author_id (
          id,
          name,
          avatar_url,
          is_verified,
          is_official
        )
      `)
      .eq('discussion_id', discussionId)
      .is('parent_comment_id', null)  // Only get top-level comments
      .range(offset, offset + Number(commentLimit) - 1);
      
    // Sort comments
    if (commentSort === 'top') {
      commentsQuery = commentsQuery.order('score', { ascending: false });
    } else if (commentSort === 'newest') {
      commentsQuery = commentsQuery.order('created_at', { ascending: false });
    } else if (commentSort === 'oldest') {
      commentsQuery = commentsQuery.order('created_at', { ascending: true });
    }
    
    const { data: comments, error: commentsError } = await commentsQuery;
    
    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'comments_error',
          message: 'Error retrieving comments'
        }
      });
    }
    
    // Get total comment count for pagination
    const { count: totalComments, error: countError } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('discussion_id', discussionId)
      .is('parent_comment_id', null);
      
    if (countError) {
      console.error('Error counting comments:', countError);
    }
    
    // Get user votes on comments if authenticated
    const commentVotesPromises = comments.map(comment => {
      if (userId) {
        return supabase
          .from('votes')
          .select('value')
          .eq('target_id', comment.id)
          .eq('user_id', userId)
          .eq('target_type', 'comment')
          .maybeSingle();
      }
      return Promise.resolve({ data: null, error: null });
    });
    
    const commentVotesResults = await Promise.all(commentVotesPromises);
    
    // Format the comments
    const formattedComments = comments.map((comment, index) => {
      const voteData = commentVotesResults[index].data;
      
      return {
        id: comment.id,
        author: {
          id: comment.author_id,
          name: comment.users?.name || 'User',
          avatar: comment.users?.avatar_url || null,
          isVerified: comment.users?.is_verified || false,
          isCurrentUser: comment.author_id === userId,
          isOfficial: comment.users?.is_official || false,
          isOP: comment.author_id === discussion.author_id
        },
        content: comment.content,
        timestamp: new Date(comment.created_at).getTime(),
        formattedDate: format(new Date(comment.created_at), 'PP'),
        score: comment.score || 0,
        userVote: voteData ? voteData.value : 0,
        replyCount: comment.reply_count || 0,
        replies: [] // We don't fetch nested replies here for performance
      };
    });
    
    // Format the complete discussion response
    const formattedDiscussion: DiscussionDetailResponse = {
      id: discussion.id,
      title: discussion.title,
      content: discussion.content,
      author: {
        id: discussion.author_id,
        name: discussion.users?.name || 'User',
        avatar: discussion.users?.avatar_url || null,
        isVerified: discussion.users?.is_verified || false,
        isOP: true,
        isCurrentUser: discussion.author_id === userId,
        isOfficial: discussion.users?.is_official || false
      },
      score: discussion.score || 0,
      userVote: userVote,
      timestamp: new Date(discussion.created_at).getTime(),
      formattedDate: format(new Date(discussion.created_at), 'PP'),
      lastActivity: new Date(discussion.last_activity_at).getTime(),
      formattedLastActivity: format(new Date(discussion.last_activity_at), 'PP'),
      isPinned: discussion.is_pinned || false,
      commentCount: discussion.comment_count || 0,
      agentId: discussion.agent_id,
      comments: formattedComments,
      commentPagination: {
        total: totalComments || 0,
        pages: Math.ceil((totalComments || 0) / Number(commentLimit)),
        current: Number(commentPage),
        limit: Number(commentLimit)
      }
    };
    
    return res.status(200).json({
      success: true,
      discussion: formattedDiscussion
    });
  } catch (error) {
    console.error('Error fetching discussion:', error);
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
 * Create a new discussion
 */
export const createDiscussion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { agentId, title, content } = req.body as CreateDiscussionRequest;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!userId || !authToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to create a discussion'
        }
      });
    }

    // Get authenticated client
    const authenticatedSupabase = getAuthenticatedClient(authToken);
    
    // Validation checks
    if (!title || title.trim().length < 5 || title.length > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Title must be between 5 and 100 characters'
        }
      });
    }
    
    if (!content || content.trim().length < 10 || content.length > 5000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Content must be between 10 and 5000 characters'
        }
      });
    }
    
    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'missing_fields',
          message: 'Agent ID is required'
        }
      });
    }

    // Check if agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .single();
      
    if (agentError) {
      if (agentError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'agent_not_found',
            message: 'Agent not found'
          }
        });
      }
      console.error('Error checking agent:', agentError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking agent'
        }
      });
    }
    
    // Create the discussion
    const { data: discussion, error: createError } = await authenticatedSupabase
      .from('discussions')
      .insert({
        title: title.trim(),
        content: content.trim(),
        author_id: userId,
        agent_id: agentId
      })
      .select()
      .single();
      
    if (createError) {
      console.error('Error creating discussion:', createError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'creation_error',
          message: 'Error creating discussion'
        }
      });
    }
    
    // Get user data for response
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('name, avatar_url, is_verified, is_official')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
    }
    
    // Format the response
    const formattedDiscussion: DiscussionDetailResponse = {
      id: discussion.id,
      title: discussion.title,
      content: discussion.content,
      author: {
        id: userId,
        name: userData?.name || 'User',
        avatar: userData?.avatar_url || null,
        isVerified: userData?.is_verified || false,
        isOP: true,
        isCurrentUser: true,
        isOfficial: userData?.is_official || false
      },
      score: 0,
      userVote: 0,
      timestamp: new Date(discussion.created_at).getTime(),
      formattedDate: format(new Date(discussion.created_at), 'PP'),
      lastActivity: new Date(discussion.last_activity_at).getTime(),
      formattedLastActivity: format(new Date(discussion.last_activity_at), 'PP'),
      isPinned: false,
      commentCount: 0,
      agentId: discussion.agent_id,
      comments: [],
      commentPagination: {
        total: 0,
        pages: 0,
        current: 1,
        limit: 20
      }
    };

    return res.status(201).json({
      success: true,
      discussion: formattedDiscussion
    });
  } catch (error) {
    console.error('Error creating discussion:', error);
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
 * Update a discussion
 */
export const updateDiscussion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { discussionId } = req.params;
    const { title, content } = req.body as UpdateDiscussionRequest;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!userId || !authToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to update a discussion'
        }
      });
    }

    // Get authenticated client
    const authenticatedSupabase = getAuthenticatedClient(authToken);
    
    // Validation checks
    if (title && (title.trim().length < 5 || title.length > 100)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Title must be between 5 and 100 characters'
        }
      });
    }
    
    if (content && (content.trim().length < 10 || content.length > 5000)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Content must be between 10 and 5000 characters'
        }
      });
    }
    
    // Check if the discussion exists and belongs to the user
    const { data: existingDiscussion, error: checkError } = await authenticatedSupabase
      .from('discussions')
      .select('author_id, agent_id')
      .eq('id', discussionId)
      .single();
      
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'not_found',
            message: 'Discussion not found'
          }
        });
      }
      console.error('Error checking discussion:', checkError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking discussion'
        }
      });
    }
    
    if (existingDiscussion.author_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You can only edit your own discussions'
        }
      });
    }
    
    // Prepare the update object
    const updateData: any = {};
    if (title) updateData.title = title.trim();
    if (content) updateData.content = content.trim();
    updateData.updated_at = new Date().toISOString();
    
    // Update the discussion using authenticated client
    const { data: updatedDiscussion, error: updateError } = await authenticatedSupabase
      .from('discussions')
      .update(updateData)
      .eq('id', discussionId)
      .select(`
        *,
        users:author_id (
          id,
          name,
          avatar_url,
          is_verified,
          is_official
        )
      `)
      .single();
      
    if (updateError) {
      console.error('Error updating discussion:', updateError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'update_error',
          message: 'Error updating discussion'
        }
      });
    }
    
    // Get user's vote
    const { data: voteData } = await authenticatedSupabase
      .from('votes')
      .select('value')
      .eq('target_id', discussionId)
      .eq('user_id', userId)
      .eq('target_type', 'discussion')
      .maybeSingle();
    
    const userVote = voteData?.value || 0;
    
    // Format the response
    const formattedDiscussion = {
      id: updatedDiscussion.id,
      title: updatedDiscussion.title,
      content: updatedDiscussion.content,
      author: {
        id: updatedDiscussion.author_id,
        name: updatedDiscussion.users?.name || 'User',
        avatar: updatedDiscussion.users?.avatar_url || null,
        isVerified: updatedDiscussion.users?.is_verified || false,
        isCurrentUser: true,
        isOfficial: updatedDiscussion.users?.is_official || false
      },
      score: updatedDiscussion.score || 0,
      userVote,
      timestamp: new Date(updatedDiscussion.created_at).getTime(),
      formattedDate: format(new Date(updatedDiscussion.created_at), 'PP'),
      lastActivity: new Date(updatedDiscussion.last_activity_at).getTime(),
      formattedLastActivity: format(new Date(updatedDiscussion.last_activity_at), 'PP'),
      isPinned: updatedDiscussion.is_pinned || false,
      commentCount: updatedDiscussion.comment_count || 0,
      agentId: updatedDiscussion.agent_id
    };
    
    return res.status(200).json({
      success: true,
      discussion: formattedDiscussion
    });
  } catch (error) {
    console.error('Error updating discussion:', error);
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
 * Delete a discussion
 */
export const deleteDiscussion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { discussionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to delete a discussion'
        }
      });
    }
    
    // Check if the discussion exists and belongs to the user
    const { data: existingDiscussion, error: checkError } = await supabase
      .from('discussions')
      .select('author_id')
      .eq('id', discussionId)
      .single();
      
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'not_found',
            message: 'Discussion not found'
          }
        });
      }
      console.error('Error checking discussion:', checkError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking discussion'
        }
      });
    }
    
    if (existingDiscussion.author_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You can only delete your own discussions'
        }
      });
    }
    
    // Delete the discussion
    const { error: deleteError } = await supabase
      .from('discussions')
      .delete()
      .eq('id', discussionId);
      
    if (deleteError) {
      console.error('Error deleting discussion:', deleteError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'delete_error',
          message: 'Error deleting discussion'
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Discussion successfully deleted'
    });
  } catch (error) {
    console.error('Error deleting discussion:', error);
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
 * Vote on a discussion
 */
export const voteOnDiscussion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { discussionId } = req.params;
    const { vote } = req.body as VoteRequest;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to vote'
        }
      });
    }
    
    // Validate vote value
    if (vote !== -1 && vote !== 0 && vote !== 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'invalid_vote',
          message: 'Vote must be -1, 0, or 1'
        }
      });
    }
    
    // Check if discussion exists
    const { data: discussion, error: discussionError } = await supabase
      .from('discussions')
      .select('id, score')
      .eq('id', discussionId)
      .single();
      
    if (discussionError) {
      if (discussionError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'not_found',
            message: 'Discussion not found'
          }
        });
      }
      console.error('Error checking discussion:', discussionError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking discussion'
        }
      });
    }
    
    // Check if user has already voted
    const { data: existingVote, error: voteCheckError } = await supabase
      .from('votes')
      .select('id, value')
      .eq('user_id', userId)
      .eq('target_id', discussionId)
      .eq('target_type', 'discussion')
      .maybeSingle();
      
    if (voteCheckError && voteCheckError.code !== 'PGRST116') {
      console.error('Error checking existing vote:', voteCheckError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking existing vote'
        }
      });
    }
    
    // Handle the vote based on the existing vote status
    if (existingVote) {
      if (vote === 0) {
        // Remove vote
        const { error: deleteError } = await supabase
          .from('votes')
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
          
        // Approximate the new score (actual score will be updated by trigger)
        const approximateScore = discussion.score - existingVote.value;
          
        return res.status(200).json({
          success: true,
          discussionId,
          newScore: approximateScore,
          userVote: 0
        });
      } else if (existingVote.value !== vote) {
        // Update existing vote
        const { error: updateError } = await supabase
          .from('votes')
          .update({ value: vote, updated_at: new Date().toISOString() })
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
          
        // Approximate the new score (actual score will be updated by trigger)
        const approximateScore = discussion.score - existingVote.value + vote;
          
        return res.status(200).json({
          success: true,
          discussionId,
          newScore: approximateScore,
          userVote: vote
        });
      } else {
        // Vote is the same, no change needed
        return res.status(200).json({
          success: true,
          discussionId,
          newScore: discussion.score,
          userVote: vote
        });
      }
    } else if (vote !== 0) {
      // Create new vote
      const { error: insertError } = await supabase
        .from('votes')
        .insert({
          user_id: userId,
          target_id: discussionId,
          target_type: 'discussion',
          value: vote
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
        
      // Approximate the new score (actual score will be updated by trigger)
      const approximateScore = discussion.score + vote;
        
      return res.status(200).json({
        success: true,
        discussionId,
        newScore: approximateScore,
        userVote: vote
      });
    } else {
      // No existing vote and trying to remove vote (do nothing)
      return res.status(200).json({
        success: true,
        discussionId,
        newScore: discussion.score,
        userVote: 0
      });
    }
  } catch (error) {
    console.error('Error voting on discussion:', error);
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
 * Get comments for a discussion
 */
export const getComments = async (req: Request, res: Response) => {
  try {
    const { discussionId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      sort = 'top', 
      parentCommentId = null 
    } = req.query;
    const userId = (req as AuthenticatedRequest).user?.id;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    // Check if the discussion exists
    const { data: discussion, error: discussionError } = await supabase
      .from('discussions')
      .select('id, author_id')
      .eq('id', discussionId)
      .single();
      
    if (discussionError) {
      if (discussionError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'not_found',
            message: 'Discussion not found'
          }
        });
      }
      console.error('Error checking discussion:', discussionError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking discussion'
        }
      });
    }
    
    // Build query for comments
    let query = supabase
      .from('comments')
      .select(`
        *,
        users:author_id (
          id,
          name,
          avatar_url,
          is_verified,
          is_official
        )
      `)
      .eq('discussion_id', discussionId)
      .eq('is_deleted', false);
      
    // If parentCommentId is specified, get replies to that comment
    if (parentCommentId && parentCommentId !== 'null') {
      query = query.eq('parent_comment_id', parentCommentId);
    } else {
      // Otherwise get top-level comments
      query = query.is('parent_comment_id', null);
    }
    
    // Add sorting
    if (sort === 'top') {
      query = query.order('score', { ascending: false });
    } else if (sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true });
    }
    
    // Add pagination
    query = query.range(offset, offset + Number(limit) - 1);
    
    // Execute the query
    const { data: comments, error: commentsError } = await query;
    
    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'comments_error',
          message: 'Error retrieving comments'
        }
      });
    }
    
    // Get total comment count for pagination
    let countQuery = supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('discussion_id', discussionId)
      .eq('is_deleted', false);
      
    if (parentCommentId && parentCommentId !== 'null') {
      countQuery = countQuery.eq('parent_comment_id', parentCommentId);
    } else {
      countQuery = countQuery.is('parent_comment_id', null);
    }
    
    const { count: totalComments, error: countError } = await countQuery;
    
    if (countError) {
      console.error('Error counting comments:', countError);
    }
    
    // Get user votes on comments if authenticated
    const votesPromises = comments.map(comment => {
      if (userId) {
        return supabase
          .from('votes')
          .select('value')
          .eq('target_id', comment.id)
          .eq('user_id', userId)
          .eq('target_type', 'comment')
          .maybeSingle();
      }
      return Promise.resolve({ data: null, error: null });
    });
    
    const votesResults = await Promise.all(votesPromises);
    
    // Format the comments
    const formattedComments: CommentResponse[] = comments.map((comment, index) => {
      const voteData = votesResults[index].data;
      
      return {
        id: comment.id,
        author: {
          id: comment.author_id,
          name: comment.users?.name || 'User',
          avatar: comment.users?.avatar_url || null,
          isVerified: comment.users?.is_verified || false,
          isCurrentUser: comment.author_id === userId,
          isOfficial: comment.users?.is_official || false,
          isOP: comment.author_id === discussion.author_id
        },
        content: comment.content,
        timestamp: new Date(comment.created_at).getTime(),
        formattedDate: format(new Date(comment.created_at), 'PP'),
        score: comment.score || 0,
        userVote: voteData ? voteData.value : 0,
        replyCount: comment.reply_count || 0,
        replies: [] // We don't fetch nested replies here for performance
      };
    });
    
    return res.status(200).json({
      success: true,
      comments: formattedComments,
      pagination: {
        total: totalComments || 0,
        pages: Math.ceil((totalComments || 0) / Number(limit)),
        current: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
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
 * Add a comment to a discussion
 */
export const addComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { discussionId } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.user?.id;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!userId || !authToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to comment'
        }
      });
    }
    
    // Get authenticated client
    const authenticatedSupabase = getAuthenticatedClient(authToken);
    
    // Validation checks
    if (!content || content.trim().length < 1 || content.length > 2000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Content must be between 1 and 2000 characters'
        }
      });
    }
    
    // Check if the discussion exists
    const { data: discussion, error: discussionError } = await supabase
      .from('discussions')
      .select('id, author_id')
      .eq('id', discussionId)
      .single();
      
    if (discussionError) {
      if (discussionError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'not_found',
            message: 'Discussion not found'
          }
        });
      }
      console.error('Error checking discussion:', discussionError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking discussion'
        }
      });
    }
    
    // If this is a reply, check if parent comment exists
    if (parentCommentId) {
      const { data: parentComment, error: parentCheckError } = await supabase
        .from('comments')
        .select('id')
        .eq('id', parentCommentId)
        .eq('discussion_id', discussionId)
        .single();
        
      if (parentCheckError) {
        if (parentCheckError.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: {
              code: 'parent_not_found',
              message: 'Parent comment not found'
            }
          });
        }
        console.error('Error checking parent comment:', parentCheckError);
        return res.status(500).json({
          success: false,
          error: {
            code: 'database_error',
            message: 'Error checking parent comment'
          }
        });
      }
    }
    
    // Create the comment - USE AUTHENTICATED CLIENT HERE
    const { data: comment, error: createError } = await authenticatedSupabase
      .from('comments')
      .insert({
        content: content.trim(),
        author_id: userId,
        discussion_id: discussionId,
        parent_comment_id: parentCommentId || null
      })
      .select()
      .single();
      
    if (createError) {
      console.error('Error creating comment:', createError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'creation_error',
          message: 'Error creating comment'
        }
      });
    }
    
    // Get user data for response
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('name, avatar_url, is_verified, is_official')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
    }
    
    // Format the response
    const commentResponse: CommentResponse = {
      id: comment.id,
      author: {
        id: userId,
        name: userData?.name || 'User',
        avatar: userData?.avatar_url || null,
        isVerified: userData?.is_verified || false,
        isCurrentUser: true,
        isOfficial: userData?.is_official || false,
        isOP: userId === discussion.author_id
      },
      content: comment.content,
      timestamp: new Date(comment.created_at).getTime(),
      formattedDate: format(new Date(comment.created_at), 'PP'),
      score: 0,
      userVote: 0,
      replyCount: 0,
      replies: []
    };
    
    return res.status(201).json({
      success: true,
      comment: commentResponse
    });
  } catch (error) {
    console.error('Error adding comment:', error);
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
 * Vote on a comment
 */
export const voteOnComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const { vote } = req.body as VoteRequest;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to vote'
        }
      });
    }

    // Validate vote value
    if (vote !== -1 && vote !== 0 && vote !== 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'invalid_vote',
          message: 'Vote must be -1, 0, or 1'
        }
      });
    }

    // Check if comment exists
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, score')
      .eq('id', commentId)
      .single();

    if (commentError) {
      if (commentError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'comment_not_found',
            message: 'Comment not found'
          }
        });
      }
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking comment'
        }
      });
    }

    // Check if user has already voted
    const { data: existingVote, error: voteCheckError } = await supabase
      .from('votes')
      .select('id, value')
      .eq('user_id', userId)
      .eq('target_id', commentId)
      .eq('target_type', 'comment')
      .maybeSingle();

    if (voteCheckError && voteCheckError.code !== 'PGRST116') {
      console.error('Error checking existing vote:', voteCheckError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking existing vote'
        }
      });
    }

    // Handle the vote based on the existing vote status
    if (existingVote) {
      // If vote is the same as existing vote, remove it (toggle behavior)
      if (existingVote.value === vote) {
        await supabase
          .from('votes')
          .delete()
          .eq('id', existingVote.id);
          
        return res.status(200).json({
          success: true,
          commentId,
          newScore: comment.score - vote, // Approximate, the trigger will update the actual score
          userVote: 0
        });
      } else {
        // Update existing vote
        const { error: updateError } = await supabase
          .from('votes')
          .update({ value: vote })
          .eq('id', existingVote.id);
          
        if (updateError) {
          console.error('Error updating vote:', updateError);
          return res.status(500).json({
            success: false,
            error: {
              code: 'vote_error',
              message: 'Error updating vote'
            }
          });
        }
          
        return res.status(200).json({
          success: true,
          commentId,
          newScore: comment.score - existingVote.value + vote, // Approximate, triggers will update
          userVote: vote
        });
      }
    } else if (vote !== 0) {
      // Create new vote if not removing a vote
      const { error: insertError } = await supabase
        .from('votes')
        .insert({
          user_id: userId,
          target_id: commentId,
          target_type: 'comment',
          value: vote
        });
        
      if (insertError) {
        console.error('Error creating vote:', insertError);
        return res.status(500).json({
          success: false,
          error: {
            code: 'vote_error',
            message: 'Error creating vote'
          }
        });
      }
        
      return res.status(200).json({
        success: true,
        commentId,
        newScore: comment.score + vote, // Approximate, triggers will update
        userVote: vote
      });
    } else {
      // No existing vote and trying to remove vote (do nothing)
      return res.status(200).json({
        success: true,
        commentId,
        newScore: comment.score,
        userVote: 0
      });
    }
  } catch (error) {
    console.error('Error voting on comment:', error);
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
 * Update a comment
 */
export const updateComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body as UpdateCommentRequest;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to update a comment'
        }
      });
    }

    // Validate input
    if (!content || content.length < 1 || content.length > 2000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'invalid_content',
          message: 'Content must be between 1 and 2000 characters'
        }
      });
    }

    // Check if comment exists and belongs to the user
    const { data: existingComment, error: checkError } = await supabase
      .from('comments')
      .select('author_id, discussion_id')
      .eq('id', commentId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'comment_not_found',
            message: 'Comment not found'
          }
        });
      }
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking comment'
        }
      });
    }

    if (existingComment.author_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You can only edit your own comments'
        }
      });
    }

    // Update the comment
    const { data: comment, error: updateError } = await supabase
      .from('comments')
      .update({ content })
      .eq('id', commentId)
      .select(`
        *,
        users:author_id (
          id,
          name,
          avatar_url,
          is_verified
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating comment:', updateError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'update_error',
          message: 'Error updating comment'
        }
      });
    }

    // Get discussion author to determine if comment author is OP
    const { data: discussion, error: discussionError } = await supabase
      .from('discussions')
      .select('author_id')
      .eq('id', existingComment.discussion_id)
      .single();

    // Get user vote
    let userVote = 0;
    const { data: voteData, error: voteError } = await supabase
      .from('votes')
      .select('value')
      .eq('user_id', userId)
      .eq('target_id', commentId)
      .eq('target_type', 'comment')
      .maybeSingle();

    if (!voteError && voteData) {
      userVote = voteData.value;
    }

    // Format the response
    const response: CommentResponse = {
      id: comment.id,
      author: {
        id: comment.users?.id || userId,
        name: comment.users?.name || 'Unknown User',
        avatar: comment.users?.avatar_url || null,
        isVerified: comment.users?.is_verified || false,
        isOP: !discussionError && discussion ? comment.author_id === discussion.author_id : false
      },
      content: comment.content,
      timestamp: new Date(comment.created_at).getTime(),
      formattedDate: format(new Date(comment.created_at), 'PP'),
      score: comment.score,
      userVote,
      replyCount: comment.reply_count
    };

    return res.status(200).json({
      success: true,
      comment: response
    });
  } catch (error) {
    console.error('Error updating comment:', error);
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
 * Delete a comment
 */
export const deleteComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to delete a comment'
        }
      });
    }

    // Check if comment exists and belongs to the user
    const { data: comment, error: checkError } = await supabase
      .from('comments')
      .select('author_id')
      .eq('id', commentId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'comment_not_found',
            message: 'Comment not found'
          }
        });
      }
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking comment'
        }
      });
    }

    if (comment.author_id !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'forbidden',
          message: 'You can only delete your own comments'
        }
      });
    }

    // Delete the comment
    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      console.error('Error deleting comment:', deleteError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'delete_error',
          message: 'Error deleting comment'
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Comment successfully deleted'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
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
 * Get nested comments for a discussion (recursive)
 */
export const getNestedComments = async (req: Request, res: Response) => {
  try {
    const { discussionId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.id;
    
    // Check if the discussion exists
    const { data: discussion, error: discussionError } = await supabase
      .from('discussions')
      .select('id, author_id')
      .eq('id', discussionId)
      .single();
      
    if (discussionError) {
      if (discussionError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'not_found',
            message: 'Discussion not found'
          }
        });
      }
      console.error('Error checking discussion:', discussionError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'database_error',
          message: 'Error checking discussion'
        }
      });
    }
    
    // Helper function to recursively fetch comments and their replies
    const fetchCommentsRecursive = async (parentId: string | null): Promise<CommentResponse[]> => {
      // Build query for comments based on parent
      let query = supabase
        .from('comments')
        .select(`
          *,
          users:author_id (
            id,
            name,
            avatar_url,
            is_verified,
            is_official
          )
        `)
        .eq('discussion_id', discussionId)
        .eq('is_deleted', false)
        .order('score', { ascending: false });
      
      if (parentId) {
        query = query.eq('parent_comment_id', parentId);
      } else {
        query = query.is('parent_comment_id', null);
      }
      
      const { data: comments, error: commentsError } = await query;
      
      if (commentsError) {
        console.error('Error fetching comments:', commentsError);
        return [];
      }
      
      if (!comments || comments.length === 0) {
        return [];
      }
      
      // Get user votes on comments if authenticated
      const votesPromises = comments.map(comment => {
        if (userId) {
          return supabase
            .from('votes')
            .select('value')
            .eq('target_id', comment.id)
            .eq('user_id', userId)
            .eq('target_type', 'comment')
            .maybeSingle();
        }
        return Promise.resolve({ data: null, error: null });
      });
      
      const votesResults = await Promise.all(votesPromises);
      
      // Recursively fetch replies for each comment
      const repliesPromises = comments.map(comment => fetchCommentsRecursive(comment.id));
      const repliesResults = await Promise.all(repliesPromises);
      
      // Format the comments with their replies
      return comments.map((comment, index) => {
        const voteData = votesResults[index].data;
        
        return {
          id: comment.id,
          author: {
            id: comment.author_id,
            name: comment.users?.name || 'User',
            avatar: comment.users?.avatar_url || null,
            isVerified: comment.users?.is_verified || false,
            isCurrentUser: comment.author_id === userId,
            isOfficial: comment.users?.is_official || false,
            isOP: comment.author_id === discussion.author_id
          },
          content: comment.content,
          timestamp: new Date(comment.created_at).getTime(),
          formattedDate: format(new Date(comment.created_at), 'PP'),
          score: comment.score || 0,
          userVote: voteData ? voteData.value : 0,
          replyCount: comment.reply_count || 0,
          replies: repliesResults[index]
        };
      });
    };
    
    // Start fetching from top-level comments
    const commentsTree = await fetchCommentsRecursive(null);
    
    // Count total comments in the discussion for metadata
    const { count: totalComments, error: countError } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('discussion_id', discussionId)
      .eq('is_deleted', false);
      
    if (countError) {
      console.error('Error counting comments:', countError);
    }
    
    return res.status(200).json({
      success: true,
      comments: commentsTree,
      metadata: {
        total: totalComments || 0,
        discussionId
      }
    });
  } catch (error) {
    console.error('Error fetching nested comments:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
};