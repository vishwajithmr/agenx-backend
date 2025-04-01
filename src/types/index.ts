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
