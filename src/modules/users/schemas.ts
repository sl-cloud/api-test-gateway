import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const updateUserBodySchema = z
  .object({
    role: z.enum(['admin', 'member']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => body.role !== undefined || body.isActive !== undefined, {
    message: 'at least one of role or isActive must be provided',
  });
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: z.enum(['admin', 'member']),
  isActive: z.boolean(),
});

export const listUsersResponseSchema = z.object({
  items: z.array(publicUserSchema),
  total: z.number().int(),
});
