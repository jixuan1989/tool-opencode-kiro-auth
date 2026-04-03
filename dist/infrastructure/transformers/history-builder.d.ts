import type { CodeWhispererMessage } from '../../plugin/types'
export declare function buildHistory(
  msgs: any[],
  resolved: string,
  toolResultLimit: number
): CodeWhispererMessage[]
export declare function injectSystemPrompt(
  history: CodeWhispererMessage[],
  system: string | undefined,
  resolved: string
): CodeWhispererMessage[]
export declare function truncateHistory(
  history: CodeWhispererMessage[],
  historyLimit: number
): CodeWhispererMessage[]
export declare function historyHasToolCalling(history: CodeWhispererMessage[]): boolean
export declare function extractToolNamesFromHistory(history: CodeWhispererMessage[]): Set<string>
