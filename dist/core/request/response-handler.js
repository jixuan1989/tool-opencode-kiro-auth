import { parseEventStream } from '../../plugin/response.js';
import { transformKiroStream } from '../../plugin/streaming/index.js';
export class ResponseHandler {
    async handleSuccess(response, model, conversationId, streaming) {
        if (streaming) {
            return this.handleStreaming(response, model, conversationId);
        }
        return this.handleNonStreaming(response, model, conversationId);
    }
    async handleStreaming(response, model, conversationId) {
        const s = transformKiroStream(response, model, conversationId);
        return new Response(new ReadableStream({
            async start(c) {
                try {
                    for await (const e of s) {
                        c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`));
                    }
                    c.close();
                }
                catch (err) {
                    c.error(err);
                }
            }
        }), { headers: { 'Content-Type': 'text/event-stream' } });
    }
    async handleNonStreaming(response, model, conversationId) {
        const text = await response.text();
        const p = parseEventStream(text);
        const oai = {
            id: conversationId,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
                {
                    index: 0,
                    message: { role: 'assistant', content: p.content },
                    finish_reason: p.stopReason === 'tool_use' ? 'tool_calls' : 'stop'
                }
            ],
            usage: {
                prompt_tokens: p.inputTokens || 0,
                completion_tokens: p.outputTokens || 0,
                total_tokens: (p.inputTokens || 0) + (p.outputTokens || 0)
            }
        };
        if (p.toolCalls.length > 0) {
            oai.choices[0].message.tool_calls = p.toolCalls.map((tc) => ({
                id: tc.toolUseId,
                type: 'function',
                function: {
                    name: tc.name,
                    arguments: typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input)
                }
            }));
        }
        return new Response(JSON.stringify(oai), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
