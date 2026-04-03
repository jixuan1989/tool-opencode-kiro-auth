export declare class ResponseHandler {
  handleSuccess(
    response: Response,
    model: string,
    conversationId: string,
    streaming: boolean
  ): Promise<Response>
  private handleStreaming
  private handleNonStreaming
}
