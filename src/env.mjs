import { z } from 'zod'

/**
 * Specify your server-side environment variables schema here. This way you can ensure the app isn't
 * built with invalid env vars.
 */
const server = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  OPEN_WEATHER_API_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().min(1).url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  UPSTASH_RATELIMITER_TOKENS_PER_TIME: z.string().min(1),
  UPSTASH_RATELIMITER_TIME_INTERVAL: z.string().min(1),
  RESEND_API_KEY: z.string().min(1)
})

/**
 * Specify your client-side environment variables schema here. This way you can ensure the app isn't
 * built with invalid env vars. To expose them to the client, prefix them with `NEXT_PUBLIC_`.
 */
const client = z.object({
  // NEXT_PUBLIC_CLIENTVAR: z.string().min(1),
})

/**
 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
 * middlewares) or client-side so we need to destruct manually.
 *
 * @type {Record<keyof z.infer<typeof server> | keyof z.infer<typeof client>, string | undefined>}
 */
const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  OPEN_WEATHER_API_KEY: process.env.OPEN_WEATHER_API_KEY,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  UPSTASH_RATELIMITER_TOKENS_PER_TIME:
    process.env.UPSTASH_RATELIMITER_TOKENS_PER_TIME,
  UPSTASH_RATELIMITER_TIME_INTERVAL:
    process.env.UPSTASH_RATELIMITER_TIME_INTERVAL,
  RESEND_API_KEY: process.env.RESEND_API_KEY
  // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
}

// Don't touch the part below
// --------------------------

const merged = server.merge(client)

/** @typedef {z.input<typeof merged>} MergedInput */
/** @typedef {z.infer<typeof merged>} MergedOutput */
/** @typedef {z.SafeParseReturnType<MergedInput, MergedOutput>} MergedSafeParseReturn */

let env = /** @type {MergedOutput} */ (process.env)

if (!!process.env.SKIP_ENV_VALIDATION == false) {
  const isServer = typeof window === 'undefined'

  const parsed = /** @type {MergedSafeParseReturn} */ (
    isServer
      ? merged.safeParse(processEnv) // on server we can validate all env vars
      : client.safeParse(processEnv) // on client we can only validate the ones that are exposed
  )

  if (parsed.success === false) {
    console.error(
      '❌ Invalid environment variables:',
      parsed.error.flatten().fieldErrors
    )
    throw new Error('Invalid environment variables')
  }

  env = new Proxy(parsed.data, {
    get (target, prop) {
      if (typeof prop !== 'string') return undefined
      // Throw a descriptive error if a server-side env var is accessed on the client
      // Otherwise it would just be returning `undefined` and be annoying to debug
      if (!isServer && !prop.startsWith('NEXT_PUBLIC_')) {
        throw new Error(
          process.env.NODE_ENV === 'production'
            ? '❌ Attempted to access a server-side environment variable on the client'
            : `❌ Attempted to access server-side environment variable '${prop}' on the client`
        )
      }
      return target[/** @type {keyof typeof target} */ (prop)]
    }
  })
}

export { env }
