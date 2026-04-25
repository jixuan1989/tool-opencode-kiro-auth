import type { KiroRegion } from './plugin/types'
/**
 * Returns a stable machine identifier matching node-machine-id behavior.
 * macOS: SHA-256 of IOPlatformUUID
 * Linux: SHA-256 of /var/lib/dbus/machine-id or /etc/machine-id
 * Windows: SHA-256 of MachineGuid from registry
 */
export declare function getMachineId(): string
export declare function isValidRegion(region: string): region is KiroRegion
export declare function normalizeRegion(region: string | undefined): KiroRegion
export declare function buildUrl(template: string, region: KiroRegion): string
export declare function extractRegionFromArn(arn: string | undefined): KiroRegion | undefined
export declare const KIRO_CONSTANTS: {
  REFRESH_URL: string
  REFRESH_IDC_URL: string
  BASE_URL: string
  USAGE_LIMITS_URL: string
  DEFAULT_REGION: KiroRegion
  AXIOS_TIMEOUT: number
  USER_AGENT: string
  CW_CLIENT_VERSION: string
  KIRO_IDE_VERSION: string
  CHAT_TRIGGER_TYPE_MANUAL: string
  ORIGIN_AI_EDITOR: string
}
export declare const MODEL_MAPPING: Record<string, string>
export declare const SUPPORTED_MODELS: string[]
export declare function isLongContextModel(model: string): boolean
export declare const KIRO_AUTH_SERVICE: {
  ENDPOINT: string
  SSO_OIDC_ENDPOINT: string
  BUILDER_ID_START_URL: string
  USER_INFO_URL: string
  SCOPES: string[]
}
