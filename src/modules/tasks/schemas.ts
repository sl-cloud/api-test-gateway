import { z } from 'zod';

const statusEnum = z.enum(['todo', 'in_progress', 'done']);
const priorityEnum = z.enum(['low', 'medium', 'high']);

export const createTaskBodySchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  priority: priorityEnum.default('medium'),
  assigneeId: z.string().uuid().optional(),
  dueDate: z
    .string()
    .date()
    .optional()
    .refine((d) => !d || new Date(d) >= new Date(new Date().toDateString()), {
      message: 'dueDate must not be in the past',
    }),
});
export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;

export const updateTaskBodySchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
});
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;

export const listTasksQuerySchema = z.object({
  status: statusEnum.optional(),
  assigneeId: z.string().uuid().optional(),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

export const taskResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: statusEnum,
  priority: priorityEnum,
  assigneeId: z.string().uuid().nullable(),
  dueDate: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listTasksResponseSchema = z.array(taskResponseSchema);
