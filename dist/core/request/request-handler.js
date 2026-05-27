import { isPermanentError } from '../../plugin/health.js';
import * as logger from '../../plugin/logger.js';
import { transformToCodeWhisperer } from '../../plugin/request.js';
import { syncFromKiroCli } from '../../plugin/sync/kiro-cli.js';
import { AccountSelector } from '../account/account-selector.js';
import { UsageTracker } from '../account/usage-tracker.js';
import { TokenRefresher } from '../auth/token-refresher.js';
import { ErrorHandler } from './error-handler.js';
import { ResponseHandler } from './response-handler.js';
import { RetryStrategy } from './retry-strategy.js';
const KIRO_API_PATTERN = /^(https?:\/\/)?q\.[a-z0-9-]+\.amazonaws\.com/;
export class RequestHandler {
    accountManager;
    config;
    repository;
    accountSelector;
    tokenRefresher;
    errorHandler;
    responseHandler;
    usageTracker;
    retryStrategy;
    constructor(accountManager, config, repository) {
        this.accountManager = accountManager;
        this.config = config;
        this.repository = repository;
        this.accountSelector = new AccountSelector(accountManager, config, syncFromKiroCli, repository);
        this.tokenRefresher = new TokenRefresher(config, accountManager, syncFromKiroCli, repository);
        this.errorHandler = new ErrorHandler(config, accountManager, repository);
        this.responseHandler = new ResponseHandler();
        this.usageTracker = new UsageTracker(config, accountManager, repository);
        this.retryStrategy = new RetryStrategy(config);
    }
    async handle(input, init, showToast) {
        const url = typeof input === 'string' ? input : input.url;
        if (!KIRO_API_PATTERN.test(url)) {
            return fetch(input, init);
        }
        return this.handleKiroRequest(url, init, showToast);
    }
    async handleKiroRequest(url, init, showToast) {
        const body = init?.body ? JSON.parse(init.body) : {};
        const model = this.extractModel(url) || body.model || 'claude-sonnet-4-5';
        const think = model.endsWith('-thinking') || !!body.providerOptions?.thinkingConfig;
        const budget = body.providerOptions?.thinkingConfig?.thinkingBudget || 20000;
        let reductionFactor = 1.0;
        let retry = 0;
        let consecutiveNullAccounts = 0;
        let forceRefresh = false;
        const retryContext = this.retryStrategy.createContext();
        while (true) {
            const check = this.retryStrategy.shouldContinue(retryContext);
            if (!check.canContinue) {
                throw new Error(check.error);
            }
            if (this.allAccountsPermanentlyUnhealthy()) {
                throw new Error('All accounts are permanently unhealthy (quota exceeded or suspended)');
            }
            let acc = await this.accountSelector.selectHealthyAccount(showToast);
            if (!acc) {
                consecutiveNullAccounts++;
                const backoffDelay = Math.min(1000 * Math.pow(2, consecutiveNullAccounts - 1), 10000);
                await this.sleep(backoffDelay);
                continue;
            }
            consecutiveNullAccounts = 0;
            const auth = this.accountManager.toAuthDetails(acc);
            if (forceRefresh) {
                auth.expires = 0;
                forceRefresh = false;
            }
            const tokenResult = await this.tokenRefresher.refreshIfNeeded(acc, auth, showToast);
            if (tokenResult.shouldContinue) {
                acc = tokenResult.account;
                await this.sleep(500);
                continue;
            }
            const prep = this.prepareRequest(url, init?.body, model, auth, think, budget, reductionFactor);
            const apiTimestamp = this.config.enable_log_api_request ? logger.getTimestamp() : null;
            if (apiTimestamp) {
                this.logRequest(prep, acc, apiTimestamp);
            }
            try {
                const res = await fetch(prep.url, prep.init);
                if (!res.ok) {
                    console.error(`[kiro-auth] !res.ok: ${res.status} ${res.statusText} url:`, prep.url);
                    console.error(`[kiro-auth] request headers:`, JSON.stringify(prep.init?.headers ?? {}));
                    const reqBody = typeof prep.init?.body === 'string' ? prep.init.body.slice(0, 1000) : '(non-string)';
                    console.error(`[kiro-auth] request body (first 1000):`, reqBody);
                }
                if (apiTimestamp) {
                    this.logResponse(res, prep, apiTimestamp);
                }
                if (res.ok) {
                    this.handleSuccessfulRequest(acc);
                    this.usageTracker.syncUsage(acc, auth);
                    return await this.responseHandler.handleSuccess(res, model, prep.conversationId, prep.streaming);
                }
                const errorResult = await this.errorHandler.handle(null, res, acc, { reductionFactor, retry }, showToast);
                if (errorResult.shouldRetry) {
                    if (errorResult.newContext) {
                        reductionFactor = errorResult.newContext.reductionFactor;
                        retry = errorResult.newContext.retry;
                    }
                    if (errorResult.forceRefresh) {
                        forceRefresh = true;
                    }
                    if (errorResult.switchAccount) {
                        continue;
                    }
                    continue;
                }
                this.logError(prep, res, acc, apiTimestamp);
                const errorBody = await res.text().catch(() => '');
                console.error(`[kiro-auth] ${res.status} response:`, errorBody.slice(0, 2000));
                console.error(`[kiro-auth] request model:`, model, 'think:', think);
                throw new Error(`Kiro Error: ${res.status}: ${errorBody.slice(0, 500)}`);
            }
            catch (e) {
                const networkResult = await this.errorHandler.handleNetworkError(e, { reductionFactor, retry }, showToast);
                if (networkResult.shouldRetry) {
                    if (networkResult.newContext) {
                        retry = networkResult.newContext.retry;
                    }
                    continue;
                }
                throw e;
            }
        }
    }
    extractModel(url) {
        return url.match(/models\/([^/:]+)/)?.[1] || null;
    }
    prepareRequest(url, body, model, auth, think, budget, reductionFactor) {
        return transformToCodeWhisperer(url, body, model, auth, think, budget, reductionFactor);
    }
    handleSuccessfulRequest(acc) {
        if (acc.failCount && acc.failCount > 0) {
            if (!isPermanentError(acc.unhealthyReason)) {
                acc.failCount = 0;
                acc.isHealthy = true;
                delete acc.unhealthyReason;
                delete acc.recoveryTime;
                this.repository.save(acc).catch(() => { });
            }
        }
    }
    logRequest(prep, acc, timestamp) {
        let b = null;
        try {
            b = prep.init.body ? JSON.parse(prep.init.body) : null;
        }
        catch { }
        logger.logApiRequest({
            url: prep.url,
            method: prep.init.method,
            headers: prep.init.headers,
            body: b,
            conversationId: prep.conversationId,
            model: prep.effectiveModel,
            email: acc.email
        }, timestamp);
    }
    logResponse(res, prep, timestamp) {
        const h = {};
        res.headers.forEach((v, k) => {
            h[k] = v;
        });
        logger.logApiResponse({
            status: res.status,
            statusText: res.statusText,
            headers: h,
            conversationId: prep.conversationId,
            model: prep.effectiveModel
        }, timestamp);
    }
    logError(prep, res, acc, apiTimestamp) {
        const h = {};
        res.headers.forEach((v, k) => {
            h[k] = v;
        });
        const rData = {
            status: res.status,
            statusText: res.statusText,
            headers: h,
            error: `Kiro Error: ${res.status}`,
            conversationId: prep.conversationId,
            model: prep.effectiveModel
        };
        let lastB = null;
        try {
            lastB = prep.init.body ? JSON.parse(prep.init.body) : null;
        }
        catch { }
        if (!this.config.enable_log_api_request) {
            logger.logApiError({
                url: prep.url,
                method: prep.init.method,
                headers: prep.init.headers,
                body: lastB,
                conversationId: prep.conversationId,
                model: prep.effectiveModel,
                email: acc.email
            }, rData, logger.getTimestamp());
        }
    }
    allAccountsPermanentlyUnhealthy() {
        const accounts = this.accountManager.getAccounts();
        if (accounts.length === 0) {
            return false;
        }
        return accounts.every((acc) => !acc.isHealthy && isPermanentError(acc.unhealthyReason));
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
