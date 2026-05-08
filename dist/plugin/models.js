import { MODEL_MAPPING } from '../constants.js';
export function resolveKiroModel(model) {
    return MODEL_MAPPING[model] ?? model;
}
