import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { platform } from 'node:os'
import { RegionSchema } from './plugin/config/schema'
import type { KiroRegion } from './plugin/types'

const VALID_REGIONS: readonly KiroRegion[] = Object.values(RegionSchema.Values)

let _cachedMachineId: string | undefined

/**
 * Returns a stable machine identifier matching node-machine-id behavior.
 * macOS: SHA-256 of IOPlatformUUID
 * Linux: SHA-256 of /var/lib/dbus/machine-id or /etc/machine-id
 * Windows: SHA-256 of MachineGuid from registry
 */
export function getMachineId(): string {
  if (_cachedMachineId) return _cachedMachineId
  try {
    const p = platform()
    let raw: string
    if (p === 'darwin') {
      raw = execSync(
        "ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID | awk -F'\"' '{print $4}'",
        { encoding: 'utf-8', timeout: 3000 }
      ).trim()
    } else if (p === 'win32') {
      raw =
        execSync('REG QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', {
          encoding: 'utf-8',
          timeout: 3000
        })
          .split('REG_SZ')[1]
          ?.trim() || ''
    } else {
      raw = execSync('cat /var/lib/dbus/machine-id 2>/dev/null || cat /etc/machine-id', {
        encoding: 'utf-8',
        timeout: 3000
      }).trim()
    }
    _cachedMachineId = createHash('sha256').update(raw).digest('hex')
  } catch {
    _cachedMachineId = 'UNDETERMINED_MACHINE_ID'
  }
  return _cachedMachineId
}

export function isValidRegion(region: string): region is KiroRegion {
  return VALID_REGIONS.includes(region as KiroRegion)
}

export function normalizeRegion(region: string | undefined): KiroRegion {
  if (!region || !isValidRegion(region)) {
    return 'us-east-1'
  }
  return region
}

export function buildUrl(template: string, region: KiroRegion): string {
  const url = template.replace('{{region}}', region)

  try {
    new URL(url)
    return url
  } catch {
    throw new Error(`Invalid URL generated: ${url}`)
  }
}

export function extractRegionFromArn(arn: string | undefined): KiroRegion | undefined {
  if (!arn) return undefined
  const parts = arn.split(':')
  if (parts.length < 6) return undefined
  if (parts[0] !== 'arn') return undefined
  const region = parts[3]
  if (typeof region !== 'string' || !region) return undefined
  return isValidRegion(region) ? (region as KiroRegion) : undefined
}

export const KIRO_CONSTANTS = {
  REFRESH_URL: 'https://prod.{{region}}.auth.desktop.kiro.dev/refreshToken',
  REFRESH_IDC_URL: 'https://oidc.{{region}}.amazonaws.com/token',
  BASE_URL: 'https://q.{{region}}.amazonaws.com/generateAssistantResponse',
  USAGE_LIMITS_URL: 'https://q.{{region}}.amazonaws.com/getUsageLimits',
  DEFAULT_REGION: 'us-east-1' as KiroRegion,
  AXIOS_TIMEOUT: 120000,
  USER_AGENT: 'KiroIDE',
  CW_CLIENT_VERSION: '1.0.34',
  KIRO_IDE_VERSION: '0.12.224',
  CHAT_TRIGGER_TYPE_MANUAL: 'MANUAL',
  ORIGIN_AI_EDITOR: 'AI_EDITOR'
}

export const MODEL_MAPPING: Record<string, string> = {
  auto: 'auto',
  'claude-haiku-4-5': 'claude-haiku-4.5',
  'claude-haiku-4-5-thinking': 'claude-haiku-4.5',
  'claude-sonnet-4-5': 'claude-sonnet-4.5',
  'claude-sonnet-4-5-thinking': 'claude-sonnet-4.5',
  'claude-sonnet-4-5-1m': 'claude-sonnet-4.5-1m',
  'claude-sonnet-4-5-1m-thinking': 'claude-sonnet-4.5-1m',
  'claude-sonnet-4-6': 'claude-sonnet-4.6',
  'claude-sonnet-4-6-thinking': 'claude-sonnet-4.6',
  'claude-sonnet-4-6-1m': 'claude-sonnet-4.6-1m',
  'claude-sonnet-4-6-1m-thinking': 'claude-sonnet-4.6-1m',
  'claude-opus-4-5': 'claude-opus-4.5',
  'claude-opus-4-5-thinking': 'claude-opus-4.5',
  'claude-opus-4-6': 'claude-opus-4.6',
  'claude-opus-4-6-thinking': 'claude-opus-4.6',
  'claude-opus-4-6-1m': 'claude-opus-4.6-1m',
  'claude-opus-4-6-1m-thinking': 'claude-opus-4.6-1m',
  'claude-sonnet-4': 'claude-sonnet-4',
  'claude-3-7-sonnet': 'CLAUDE_3_7_SONNET_20250219_V1_0',
  'claude-opus-4.6': 'claude-opus-4.6',
  'claude-opus-4.7': 'claude-opus-4.7',
  'claude-sonnet-4.6': 'claude-sonnet-4.6',
  'claude-sonnet-4.5': 'claude-sonnet-4.5',
  'claude-opus-4.5': 'claude-opus-4.5',
  'claude-haiku-4.5': 'claude-haiku-4.5',
  'minimax-m2.1': 'MINIMAX_MINIMAX_M2',
  'minimax-m2.5': 'MINIMAX_MINIMAX_M2',
  'deepseek-3.2': 'DEEPSEEK_V3_2',
  'glm-5': 'glm-5',
  'qwen3-coder-next': 'QWEN3_CODER_480B_A35B_1_0'
}

export const SUPPORTED_MODELS = Object.keys(MODEL_MAPPING)

const LONG_CONTEXT_MODELS = new Set(Object.keys(MODEL_MAPPING).filter((k) => k.includes('-1m')))

export function isLongContextModel(model: string): boolean {
  return LONG_CONTEXT_MODELS.has(model)
}

export const KIRO_AUTH_SERVICE = {
  ENDPOINT: 'https://prod.{{region}}.auth.desktop.kiro.dev',
  SSO_OIDC_ENDPOINT: 'https://oidc.{{region}}.amazonaws.com',
  BUILDER_ID_START_URL: 'https://view.awsapps.com/start',
  USER_INFO_URL: 'https://view.awsapps.com/api/user/info',
  SCOPES: [
    'codewhisperer:completions',
    'codewhisperer:analysis',
    'codewhisperer:conversations',
    'codewhisperer:transformations',
    'codewhisperer:taskassist'
  ]
}
