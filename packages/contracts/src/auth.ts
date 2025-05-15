import { z } from 'zod';
import type { LoyaltyTier, UserRole, UserStatus } from './common';

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const RegisterSchema = z.object({
  email: z.email().max(254),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscore'),
  password: PasswordSchema,
  displayName: z.string().min(2).max(40).optional(),
  acceptTerms: z.literal(true, { error: 'You must accept the demo terms' }),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  identifier: z.string().min(3).max(254),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: PasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).max(40).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  avatarSeed: z.string().min(1).max(64).optional(),
  soundEnabled: z.boolean().optional(),
  sessionReminderMinutes: z.number().int().min(0).max(240).optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export interface AuthUserDto {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  statusUntil: string | null;
  createdAt: string;
  profile: {
    displayName: string;
    avatarSeed: string;
    country: string;
    soundEnabled: boolean;
    sessionReminderMinutes: number;
  };
  loyalty: { tier: LoyaltyTier; points: number; lifetimePoints: number };
}

export interface AuthResponseDto {
  user: AuthUserDto;
  accessToken: string;
  expiresIn: number;
}
