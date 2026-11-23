import { z } from 'zod';

/** Legacy keys are JWTs: a `service_role` one bypasses RLS and must never ship to browsers. */
function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return (
      typeof claims === 'object' &&
      claims !== null &&
      'role' in claims &&
      claims.role === 'service_role'
    );
  } catch {
    return false;
  }
}

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1)
    // Defence in depth: refuse to boot if someone pastes a privileged key into the client bundle.
    .refine((key) => !isPrivilegedKey(key), 'Secret key must never be used client-side'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(import.meta.env);

export const env: Env | null = parsed.success ? parsed.data : null;
export const envError: string | null = parsed.success
  ? null
  : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
