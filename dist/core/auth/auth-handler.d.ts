import type { AuthHook } from '@opencode-ai/plugin';
import type { AccountRepository } from '../../infrastructure/database/account-repository.js';
export declare class AuthHandler {
    private config;
    private repository;
    private accountManager?;
    constructor(config: any, repository: AccountRepository);
    initialize(): Promise<void>;
    setAccountManager(am: any): void;
    getMethods(): AuthHook['methods'];
}
