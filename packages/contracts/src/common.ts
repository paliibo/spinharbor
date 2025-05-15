import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const IdempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_\-:.]+$/, 'idempotencyKey must be URL-safe');

export const UserRoles = ['PLAYER', 'SUPPORT', 'OPERATOR', 'ADMIN'] as const;
export type UserRole = (typeof UserRoles)[number];

export const UserStatuses = ['ACTIVE', 'SUSPENDED', 'COOLING_OFF', 'SELF_EXCLUDED', 'CLOSED'] as const;
export type UserStatus = (typeof UserStatuses)[number];

export const LoyaltyTiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
export type LoyaltyTier = (typeof LoyaltyTiers)[number];

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}
