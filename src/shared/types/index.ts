import { User } from '@supabase/supabase-js';
import { Request } from 'express';

// Auth
export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Reviews
export interface ReviewResponse {
  id: string;
  author: {
    id: string;
    name: string;
    avatar: string | null;
    isVerified: boolean;
    isCurrentUser: boolean;
    isOfficial?: boolean;
  };
  rating: number;
  date: string;
  formattedDate: string;
  content: string;
  replies: ReviewReplyResponse[];
  replyCount: number;
  helpful: {
    upvotes: number;
    downvotes: number;
    userVote: number;
  };
  additionalImages: ReviewImageResponse[];
}

export interface ReviewReplyResponse {
  id: string;
  author: {
    id: string;
    name: string;
    avatar: string | null;
    isVerified: boolean;
    isCurrentUser: boolean;
    isOfficial?: boolean;
  };
  date: string;
  formattedDate: string;
  content: string;
}

export interface ReviewImageResponse {
  id: string;
  url: string;
  thumbnailUrl: string;
  alt?: string;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  credibilityScore?: number;
  credibilityBadge: string;
  recentPositivePercentage: number;
  ratingDistribution: {
    [key: string]: number;
  };
}

// Agents
export interface Agent {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  isPro: boolean;
  likes: number;
  views: number;
  rating: number;
  usageCount: number;
  capabilities?: string[];
  company?: {
    id: string;
    name: string;
    logoUrl?: string;
    isVerified: boolean;
    isEnterprise: boolean;
  } | null;
  createdAt: string;
  isOwner: boolean;
  isLiked?: boolean;
  creator_id?: string;
  company_id?: string;
  is_public: boolean;
}


// Discussions
export interface Author {
  id: string;
  name: string;
  avatar: string | null;
  isVerified: boolean;
  isOP?: boolean;
  isCurrentUser?: boolean;
  isOfficial?: boolean;
}

export interface DiscussionResponse {
  id: string;
  title: string;
  content: string;
  author: Author;
  score: number;
  userVote: number;
  timestamp: number;
  formattedDate: string; // Add this property
  isPinned: boolean;
  commentCount: number;
  agentId: string;
  lastActivity?: number; // Make this optional
  formattedLastActivity?: string; // Add this optional property
}

export interface CommentResponse {
  id: string;
  author: Author;
  content: string;
  timestamp: number;
  formattedDate: string; // Add this property
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

// Re-export all types from discussion.ts
export * from './discussion';

// Add any additional types or extend existing ones here
import { Author as BaseAuthor } from './discussion';

// Extend the Author interface to include isCurrentUser
export interface ExtendedAuthor extends BaseAuthor {
  isCurrentUser?: boolean;
}
