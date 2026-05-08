import type { KiroAuthDetails, PreparedRequest } from './types';
export declare function transformToCodeWhisperer(url: string, body: any, model: string, auth: KiroAuthDetails, think?: boolean, budget?: number, reductionFactor?: number): PreparedRequest;
