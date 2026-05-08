import { MODEL_MAPPING } from '../constants'

export function resolveKiroModel(model: string): string {
  return MODEL_MAPPING[model] ?? model
}
