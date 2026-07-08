import { z } from 'zod';

export const createProjectBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

export const updateProjectBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
  })
  .refine((body) => body.name !== undefined || body.description !== undefined, {
    message: 'at least one field must be provided',
  });
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;

export const addMemberBodySchema = z.object({ userId: z.string().uuid() });
export type AddMemberBody = z.infer<typeof addMemberBodySchema>;

export const listProjectsQuerySchema = z.object({
  all: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export const projectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.string().uuid(),
  status: z.enum(['active', 'archived']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listProjectsResponseSchema = z.array(projectResponseSchema);
