import { KIRO_CONSTANTS, getMachineId } from '../constants';
import { decodeRefreshToken, encodeRefreshToken } from '../kiro/auth';
import { KiroTokenRefreshError } from './errors';
export async function refreshAccessToken(auth) {
    const p = decodeRefreshToken(auth.refresh);
    const isIdc = auth.authMethod === 'idc';
    const oidcRegion = auth.oidcRegion || auth.region;
    const url = isIdc
        ? `https://oidc.${oidcRegion}.amazonaws.com/token`
        : `https://prod.${auth.region}.auth.desktop.kiro.dev/refreshToken`;
    if (isIdc && (!p.clientId || !p.clientSecret)) {
        throw new KiroTokenRefreshError('Missing creds', 'MISSING_CREDENTIALS');
    }
    const requestBody = isIdc
        ? {
            refreshToken: p.refreshToken,
            clientId: p.clientId,
            clientSecret: p.clientSecret,
            grantType: 'refresh_token'
        }
        : {
            refreshToken: p.refreshToken
        };
    const kiroVer = KIRO_CONSTANTS.KIRO_IDE_VERSION;
    const machineId = getMachineId();
    const socialUa = `KiroIDE-${kiroVer}-${machineId}`;
    const cwVer = KIRO_CONSTANTS.CW_CLIENT_VERSION;
    const idcUa = `aws-sdk-js/${cwVer} ua/2.1 os/other lang/js md/browser#unknown_unknown api/sso-oidc#${cwVer} m/F KiroIDE`;
    const headers = isIdc
        ? {
            'Content-Type': 'application/json',
            'user-agent': idcUa
        }
        : {
            'Content-Type': 'application/json',
            'User-Agent': socialUa
        };
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });
        if (!res.ok) {
            const txt = await res.text();
            let data = {};
            try {
                data = JSON.parse(txt);
            }
            catch {
                data = { message: txt };
            }
            throw new KiroTokenRefreshError(`Refresh failed: ${data.message || data.error_description || txt}`, data.error || `HTTP_${res.status}`);
        }
        const d = await res.json();
        const acc = d.access_token || d.accessToken;
        if (!acc)
            throw new KiroTokenRefreshError('No access token', 'INVALID_RESPONSE');
        const upP = {
            refreshToken: d.refresh_token || d.refreshToken || p.refreshToken,
            clientId: p.clientId,
            clientSecret: p.clientSecret,
            authMethod: auth.authMethod
        };
        return {
            refresh: encodeRefreshToken(upP),
            access: acc,
            expires: Date.now() + (d.expires_in || d.expiresIn || 3600) * 1000,
            authMethod: auth.authMethod,
            region: auth.region,
            oidcRegion: auth.oidcRegion,
            profileArn: auth.profileArn,
            clientId: auth.clientId,
            clientSecret: auth.clientSecret,
            email: auth.email || d.userInfo?.email
        };
    }
    catch (error) {
        if (error instanceof KiroTokenRefreshError)
            throw error;
        throw new KiroTokenRefreshError(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'NETWORK_ERROR', error instanceof Error ? error : undefined);
    }
}
