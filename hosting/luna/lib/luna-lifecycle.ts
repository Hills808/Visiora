/** Keep the existing task alive for settlement after the client disconnects. */
export function retainAnalysis(request: Request, response: Promise<Response>,
  context: Pick<ExecutionContext, 'waitUntil'>): Promise<Response> {
  if (request.method === 'POST' && new URL(request.url).pathname === '/api/vision/analyze')
    context.waitUntil(response.then(() => undefined));
  return response;
}
