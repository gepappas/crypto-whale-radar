import { z } from 'zod';

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export function getPublicEnv(raw: Record<string, unknown>) {
  const parsed = publicEnvSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn('[env] Invalid public configuration:', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    return {};
  }
  return parsed.data;
}
