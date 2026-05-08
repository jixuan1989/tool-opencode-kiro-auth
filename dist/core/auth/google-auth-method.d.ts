import type { AuthOuathResult } from '@opencode-ai/plugin';
import type { AccountRepository } from '../../infrastructure/database/account-repository.js';
import type { KiroRegion } from '../../plugin/types.js';
export interface KiroGoogleAuthorization {
    verificationUrl: string;
    userCode: string;
    deviceCode: string;
    interval: number;
    expiresIn: number;
    region: KiroRegion;
}
export interface KiroGoogleTokenResult {
    refreshToken: string;
    accessToken: string;
    expiresAt: number;
    email: string;
    region: KiroRegion;
    authMethod: 'google';
}
export declare function authorizeKiroGoogle(region?: KiroRegion): Promise<KiroGoogleAuthorization>;
export declare function pollKiroGoogleToken(deviceCode: string, interval: number, expiresIn: number, region: KiroRegion): Promise<KiroGoogleTokenResult>;
export declare class GoogleAuthMethod {
    private config;
    private repository;
    private accountManager;
    constructor(config: any, repository: AccountRepository, accountManager: any);
    authorize(inputs?: Record<string, string>): Promise<AuthOuathResult>;
}
