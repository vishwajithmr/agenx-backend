import { Request } from 'express';
import { SupabaseClient, User } from '@supabase/supabase-js';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export interface Company {
  id?: string;
  name: string;
  logoUrl?: string;
  isVerified?: boolean;
  isEnterprise?: boolean;
}

export interface Agent {
  id?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  isPro?: boolean;
  likes?: number;
  views?: number;
  rating?: number;
  usageCount?: number;
  capabilities?: string[];
  company?: Company | null;
  createdAt?: string;
  isOwner?: boolean;
  creator_id?: string;
  company_id?: string;
  is_public?: boolean;
}

export interface DbAgent {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  is_pro?: boolean;
  likes?: number;
  views?: number;
  rating?: number;
  usage_count?: number;
  capabilities?: string[];
  company_id?: string;
  creator_id?: string;
  is_public?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DbCompany {
  id: string;
  name: string;
  logo_url?: string;
  is_verified?: boolean;
  is_enterprise?: boolean;
  creator_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthResponse {
  message: string;
  user?: User;
  session?: any;
}

export interface AgentResponse {
  message?: string;
  agent?: Agent;
  agents?: Agent[];
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
    }
  }
}

// User types
export interface User {
  id: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

// Agent types
export interface Agent {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: Date;
  updated_at: Date;
}

// Review types
export interface Review {
  id: string;
  agent_id: string;
  user_id: string;
  rating: number;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface ReviewImage {
  id: string;
  review_id: string;
  url: string;
  thumbnail_url: string;
  alt_text?: string;
  created_at: Date;
}

export interface ReviewReply {
  id: string;
  review_id: string;
  user_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface ReviewVote {
  id: string;
  review_id: string;
  user_id: string;
  vote: number; // 1 for upvote, -1 for downvote, 0 for removing vote
  created_at: Date;
  updated_at: Date;
}

// Response types
export interface ReviewAuthor {
  id: string;
  name: string;
  avatar?: string;
  isVerified: boolean;
  isCurrentUser: boolean;
  isOfficial?: boolean;
}

export interface ReviewImageResponse {
  id: string;
  url: string;
  thumbnailUrl: string;
  alt?: string;
}

export interface ReviewReplyResponse {
  id: string;
  author: ReviewAuthor;
  date: string;
  formattedDate: string;
  content: string;
}

export interface ReviewHelpful {
  upvotes: number;
  downvotes: number;
  userVote: number; // 1, -1, or 0
}

export interface ReviewResponse {
  id: string;
  author: ReviewAuthor;
  rating: number;
  date: string;
  formattedDate: string;
  content: string;
  replies: ReviewReplyResponse[];
  replyCount: number;
  helpful: ReviewHelpful;
  additionalImages: ReviewImageResponse[];
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  credibilityScore: number;
  credibilityBadge: string;
  recentPositivePercentage: number;
  ratingDistribution: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
  };
}

export interface PaginationResponse {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Request types
export interface CreateReviewRequest {
  rating: number;
  content: string;
  images?: string[]; // Base64 encoded images or image URLs
}

export interface UpdateReviewRequest {
  rating: number;
  content: string;
  images?: string[]; // Base64 encoded images or image URLs
}

export interface CreateReplyRequest {
  content: string;
}

export interface VoteRequest {
  vote: number; // 1 for upvote, -1 for downvote, 0 for removing vote
}

export interface ReviewQueryParams {
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'highest' | 'lowest' | 'most_helpful';
  rating?: number;
}

// Error types
export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}
