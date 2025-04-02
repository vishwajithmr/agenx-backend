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
  creator_id?: string;
  company_id?: string;
  is_public: boolean;
}
