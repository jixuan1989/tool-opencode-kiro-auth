import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { RegionSchema } from './plugin/config/schema';
const VALID_REGIONS = Object.values(RegionSchema.Values);
let _cachedMachineId;
/**
 * Returns a stable machine identifier matching node-machine-id behavior.
 * macOS: SHA-256 of IOPlatformUUID
 * Linux: SHA-256 of /var/lib/dbus/machine-id or /etc/machine-id
 * Windows: SHA-256 of MachineGuid from registry
 */
export function getMachineId() {
    if (_cachedMachineId)
        return _cachedMachineId;
    try {
        const p = platform();
        let raw;
        if (p === 'darwin') {
            raw = execSync("ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID | awk -F'\"' '{print $4}'", { encoding: 'utf-8', timeout: 3000 }).trim();
        }
        else if (p === 'win32') {
            raw = execSync('REG QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', { encoding: 'utf-8', timeout: 3000 })
                .split('REG_SZ')[1]
                ?.trim() || '';
        }
        else {
            raw = execSync('cat /var/lib/dbus/machine-id 2>/dev/null || cat /etc/machine-id', {
                encoding: 'utf-8',
                timeout: 3000
            }).trim();
        }
        _cachedMachineId = createHash('sha256').update(raw).digest('hex');
    }
    catch {
        _cachedMachineId = 'UNDETERMINED_MACHINE_ID';
    }
    return _cachedMachineId;
}
export function isValidRegion(region) {
    return VALID_REGIONS.includes(region);
}
export function normalizeRegion(region) {
    if (!region || !isValidRegion(region)) {
        return 'us-east-1';
    }
    return region;
}
export function buildUrl(template, region) {
    const url = template.replace('{{region}}', region);
    try {
        new URL(url);
        return url;
    }
    catch {
        throw new Error(`Invalid URL generated: ${url}`);
    }
}
export function extractRegionFromArn(arn) {
    if (!arn)
        return undefined;
    const parts = arn.split(':');
    if (parts.length < 6)
        return undefined;
    if (parts[0] !== 'arn')
        return undefined;
    const region = parts[3];
    if (typeof region !== 'string' || !region)
        return undefined;
    return isValidRegion(region) ? region : undefined;
}
export const KIRO_CONSTANTS = {
    REFRESH_URL: 'https://prod.{{region}}.auth.desktop.kiro.dev/refreshToken',
    REFRESH_IDC_URL: 'https://oidc.{{region}}.amazonaws.com/token',
    BASE_URL: 'https://q.{{region}}.amazonaws.com/generateAssistantResponse',
    USAGE_LIMITS_URL: 'https://q.{{region}}.amazonaws.com/getUsageLimits',
    DEFAULT_REGION: 'us-east-1',
    AXIOS_TIMEOUT: 120000,
    USER_AGENT: 'KiroIDE',
    CW_CLIENT_VERSION: '1.0.34',
    KIRO_IDE_VERSION: '0.11.133',
    CHAT_TRIGGER_TYPE_MANUAL: 'MANUAL',
    ORIGIN_AI_EDITOR: 'AI_EDITOR'
};
export const MODEL_MAPPING = {
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
    'nova-swe': 'AGI_NOVA_SWE_V1_5',
    'gpt-oss-120b': 'OPENAI_GPT_OSS_120B_1_0',
    'qwen3-coder-480b': 'QWEN3_CODER_480B_A35B_1_0',
    'minimax-m2': 'MINIMAX_MINIMAX_M2',
    'kimi-k2-thinking': 'MOONSHOT_KIMI_K2_THINKING'
};
export const SUPPORTED_MODELS = Object.keys(MODEL_MAPPING);
const LONG_CONTEXT_MODELS = new Set(Object.keys(MODEL_MAPPING).filter((k) => k.includes('-1m')));
export function isLongContextModel(model) {
    return LONG_CONTEXT_MODELS.has(model);
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
};
