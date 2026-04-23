import { describe, expect, test } from 'bun:test'
import { transformToCodeWhisperer } from '../plugin/request.js'
import type { KiroAuthDetails } from '../plugin/types.js'

const auth: KiroAuthDetails = {
  refresh: 'refresh-token',
  access: 'access-token',
  expires: Date.now() + 60_000,
  authMethod: 'google',
  region: 'us-east-1',
  email: 'test@example.com'
}

describe('auto model support', () => {
  test('writes auto modelId into CodeWhisperer payload', () => {
    const prepared = transformToCodeWhisperer(
      'https://q.us-east-1.amazonaws.com/v1/chat/completions',
      {
        messages: [{ role: 'user', content: 'Hello from auto' }]
      },
      'auto',
      auth
    )

    expect(prepared.effectiveModel).toBe('auto')

    const payload = JSON.parse(prepared.init.body as string)
    expect(payload.conversationState.currentMessage.userInputMessage.modelId).toBe('auto')
  })

  test('allows thinking config while keeping auto modelId', () => {
    const prepared = transformToCodeWhisperer(
      'https://q.us-east-1.amazonaws.com/v1/chat/completions',
      {
        messages: [{ role: 'user', content: 'Think about this request' }]
      },
      'auto',
      auth,
      true,
      4096
    )

    const payload = JSON.parse(prepared.init.body as string)
    const currentMessage = payload.conversationState.currentMessage.userInputMessage
    const history = payload.conversationState.history ?? []

    expect(currentMessage.modelId).toBe('auto')
    expect(
      history.some((entry: any) =>
        JSON.stringify(entry).includes('<thinking_mode>enabled</thinking_mode>')
      )
    ).toBe(true)
  })
})
