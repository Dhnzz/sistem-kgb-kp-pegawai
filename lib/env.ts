import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  CRON_SECRET: z.string().min(1).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  WEBHOOK_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid env:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  cached = parsed.data;
  return cached;
}
