export type MoyskladAuthMode = 'basic' | 'bearer'

function stripQuotes(s: string): string {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim()
  }
  return t
}

function extractTokenFromObject(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null

  // Common keys
  const candidate =
    obj?.token ??
    obj?.access_token ??
    obj?.accessToken ??
    obj?.apiKey ??
    obj?.apikey ??
    obj?.api_key ??
    obj?.api_token ??
    obj?.auth_token ??
    obj?.key ??
    obj?.secret ??
    obj?.password ??
    obj?.value

  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()

  // If unknown keys but there is exactly one long string value — take it
  const values = Object.values(obj).filter((v) => typeof v === 'string') as string[]
  const long = values
    .map((v) => v.trim())
    .filter((v) => v.length >= 16)
    .sort((a, b) => b.length - a.length)
  if (long[0]) return long[0]

  return null
}

export function normalizeMoyskladSecret(input: string): { secret: string; hintedMode: MoyskladAuthMode } {
  let s = (input || '').trim()
  if (!s) return { secret: '', hintedMode: 'basic' }

  // If pasted as "Authorization: Bearer xxx" or "Bearer xxx" / "Token xxx"
  const authHeaderMatch = s.match(/authorization\s*:\s*(.+)$/i)
  if (authHeaderMatch?.[1]) s = authHeaderMatch[1].trim()

  if (/^Bearer\s+/i.test(s)) return { secret: stripQuotes(s.replace(/^Bearer\s+/i, '')), hintedMode: 'bearer' }
  if (/^Token\s+/i.test(s)) return { secret: stripQuotes(s.replace(/^Token\s+/i, '')), hintedMode: 'bearer' }

  // JSON payload
  const maybeJson = stripQuotes(s)
  if (maybeJson.startsWith('{') && maybeJson.endsWith('}')) {
    try {
      const obj: any = JSON.parse(maybeJson)
      const extracted = extractTokenFromObject(obj)
      if (extracted) {
        const cleaned = stripQuotes(extracted)
        const bearerHint = /^(eyJ[A-Za-z0-9_-]+)\./.test(cleaned) || cleaned.includes('.') && cleaned.split('.').length >= 3
        return { secret: cleaned, hintedMode: bearerHint ? 'bearer' : 'basic' }
      }
    } catch {
      // ignore
    }
  }

  // Base64 Basic header pasted as a whole isn't supported; but we can still accept raw string
  const cleaned = stripQuotes(s)
  const bearerHint = /^(eyJ[A-Za-z0-9_-]+)\./.test(cleaned) || (cleaned.includes('.') && cleaned.split('.').length >= 3)
  return { secret: cleaned, hintedMode: bearerHint ? 'bearer' : 'basic' }
}

export function makeMoyskladHeaders(opts: {
  mode: MoyskladAuthMode
  login?: string | null
  secret: string
}): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.mode === 'bearer') {
    headers.Authorization = `Bearer ${opts.secret}`
    return headers
  }
  const login = (opts.login || '').trim()
  const authString = Buffer.from(`${login}:${opts.secret}`).toString('base64')
  headers.Authorization = `Basic ${authString}`
  return headers
}

