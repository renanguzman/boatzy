import type { UserRole } from '@/types/supabase';

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      roles?: UserRole[];
    };
  }
}

export {};
