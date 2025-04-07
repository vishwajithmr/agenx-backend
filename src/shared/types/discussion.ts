import { Request } from 'express';
import { User } from '@supabase/supabase-js';

// Auth
export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Discussion types
export interface Discussion {
  id: string;
  title: string;
  content: string;
  authorId: string;
  agentId: string;
  score: number;
  isPinned: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  discussionId: string;
  parentCommentId?: string;
  score: number;
  isDeleted: boolean;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Vote {
  id: string;
  userId: string;
  targetId: string;
  targetType: 'discussion' | 'comment';
  value: -1 | 0 | 1;
  createdAt: string;
  updatedAt: string;
}

// DB Models
export interface DbDiscussion {
  id: string;
  title: string;
  content: string;
  author_id: string;
  agent_id: string;
  score: number;
  is_pinned: boolean;
  comment_count: number;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

export interface DbComment {
  id: string;
  content: string;
  author_id: string;
  discussion_id: string;
  parent_comment_id?: string;
  score: number;
  is_deleted: boolean;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

export interface DbVote {
  id: string;
  user_id: string;
  target_id: string;
  target_type: 'discussion' | 'comment';
  value: -1 | 0 | 1;
  created_at: string;
  updated_at: string;
}

// Request/Response types
export interface Author {
  id: string;
  name: string;
  avatar: string | null;
  isVerified: boolean;
  isOP?: boolean;
}

export interface DiscussionResponse {
  id: string;
  title: string;
  content: string;
  author: Author;
  score: number;
  userVote: number;
  timestamp: number;
  isPinned: boolean;
  commentCount: number;
  agentId: string;
}

export interface CommentResponse {
  id: string;
  author: Author;
  content: string;
  timestamp: number;
  score: number;
  userVote: number;
  replyCount: number;
  replies?: CommentResponse[];
}

export interface PaginationResponse {
  total: number;
  pages: number;
  current: number;
  limit: number;
}

export interface DiscussionDetailResponse extends DiscussionResponse {
  comments: CommentResponse[];
  commentPagination: PaginationResponse;
}

// Request types
export interface CreateDiscussionRequest {
  agentId: string;
  title: string;
  content: string;
}

export interface UpdateDiscussionRequest {
  title: string;
  content: string;
}

export interface VoteRequest {
  vote: -1 | 0 | 1;
}

export interface CreateCommentRequest {
  content: string;
  parentCommentId?: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface DiscussionQueryParams {
  agentId?: string;
  page?: number;
  limit?: number;
  sort?: 'latest' | 'oldest' | 'top';
  search?: string;
}

export interface CommentQueryParams {
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'top';
  parentCommentId?: string;
}
