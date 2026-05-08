import type { AccountRepository } from '../../infrastructure/database/account-repository';
import type { AccountManager } from '../../plugin/accounts';
import type { KiroConfig } from '../../plugin/config';
type ToastFunction = (message: string, variant: 'info' | 'warning' | 'success' | 'error') => void;
export declare class RequestHandler {
    private accountManager;
    private config;
    private repository;
    private accountSelector;
    private tokenRefresher;
    private errorHandler;
    private responseHandler;
    private usageTracker;
    private retryStrategy;
    constructor(accountManager: AccountManager, config: KiroConfig, repository: AccountRepository);
    handle(input: any, init: any, showToast: ToastFunction): Promise<Response>;
    private handleKiroRequest;
    private extractModel;
    private prepareRequest;
    private handleSuccessfulRequest;
    private logRequest;
    private logResponse;
    private logError;
    private allAccountsPermanentlyUnhealthy;
    private sleep;
}
export {};
