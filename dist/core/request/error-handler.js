export class ErrorHandler {
    config;
    accountManager;
    repository;
    constructor(config, accountManager, repository) {
        this.config = config;
        this.accountManager = accountManager;
        this.repository = repository;
    }
    async handle(error, response, account, context, showToast) {
        const readBody = async () => {
            try {
                const body = JSON.parse(await response.clone().text());
                return body.message || body.Message || body.__type || JSON.stringify(body);
            }
            catch {
                return '';
            }
        };
        if (response.status === 400) {
            const reason = await readBody();
            if (context.reductionFactor > 0.4) {
                const newFactor = context.reductionFactor - 0.2;
                showToast(`400: ${reason || 'unknown'}. Retrying with ${Math.round(newFactor * 100)}%...`, 'warning');
                return {
                    shouldRetry: true,
                    newContext: { ...context, reductionFactor: newFactor }
                };
            }
        }
        if (response.status === 401 && context.retry < this.config.rate_limit_max_retries) {
            const reason = await readBody();
            showToast(`401: ${reason || 'Unauthorized'}. Retrying...`, 'warning');
            return {
                shouldRetry: true,
                newContext: { ...context, retry: context.retry + 1 }
            };
        }
        if (response.status === 500) {
            account.failCount = (account.failCount || 0) + 1;
            let errorMessage = 'Internal Server Error';
            try {
                const errorBody = await response.text();
                const errorData = JSON.parse(errorBody);
                if (errorData.message) {
                    errorMessage = errorData.message;
                }
                else if (errorData.Message) {
                    errorMessage = errorData.Message;
                }
            }
            catch (e) { }
            if (account.failCount < 5) {
                const delay = 1000 * Math.pow(2, account.failCount - 1);
                showToast(`500: ${errorMessage}. Retrying in ${Math.ceil(delay / 1000)}s...`, 'warning');
                await this.sleep(delay);
                return { shouldRetry: true };
            }
            else {
                this.accountManager.markUnhealthy(account, `Server Error (500) after 5 attempts: ${errorMessage}`);
                await this.repository.batchSave(this.accountManager.getAccounts());
                showToast(`500: ${errorMessage}. Marking account as unhealthy and switching...`, 'warning');
                return { shouldRetry: true, switchAccount: true };
            }
        }
        if (response.status === 429) {
            const w = parseInt(response.headers.get('retry-after') || '60') * 1000;
            this.accountManager.markRateLimited(account, w);
            await this.repository.batchSave(this.accountManager.getAccounts());
            const count = this.accountManager.getAccountCount();
            if (count > 1) {
                return { shouldRetry: true, switchAccount: true };
            }
            showToast(`429: Rate limited. Waiting ${Math.ceil(w / 1000)}s...`, 'warning');
            await this.sleep(w);
            return { shouldRetry: true };
        }
        if ((response.status === 402 || response.status === 403) &&
            this.accountManager.getAccountCount() > 1) {
            let errorReason = response.status === 402 ? 'Quota' : 'Forbidden';
            let isPermanent = false;
            const errorBody = await response.text();
            const errorData = (() => {
                try {
                    return JSON.parse(errorBody);
                }
                catch {
                    return null;
                }
            })();
            if (errorData?.reason === 'INVALID_MODEL_ID') {
                throw new Error(`Invalid model: ${errorData.message}`);
            }
            if (errorData?.reason === 'TEMPORARILY_SUSPENDED') {
                errorReason = 'Account Suspended';
                isPermanent = true;
            }
            if (isPermanent) {
                account.failCount = 10;
            }
            showToast(`${response.status}: ${errorReason}. Switching account...`, 'warning');
            this.accountManager.markUnhealthy(account, errorReason);
            await this.repository.batchSave(this.accountManager.getAccounts());
            return { shouldRetry: true, switchAccount: true };
        }
        const reason = await readBody();
        showToast(`${response.status}: ${reason || response.statusText}`, 'error');
        return { shouldRetry: false };
    }
    async handleNetworkError(error, context, showToast) {
        if (this.isNetworkError(error) && context.retry < this.config.rate_limit_max_retries) {
            const d = this.config.rate_limit_retry_delay_ms * Math.pow(2, context.retry);
            showToast(`Network error. Retrying in ${Math.ceil(d / 1000)}s...`, 'warning');
            await this.sleep(d);
            return {
                shouldRetry: true,
                newContext: { ...context, retry: context.retry + 1 }
            };
        }
        return { shouldRetry: false };
    }
    isNetworkError(e) {
        return (e instanceof Error && /econnreset|etimedout|enotfound|network|fetch failed/i.test(e.message));
    }
    sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
}
