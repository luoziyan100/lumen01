export interface LocalLibraryContext {
  loadLocalPaperContext?: (query: string) => Promise<string>
}

export async function executeSearchLocalLibrary(
  rawArgs: Record<string, unknown>,
  context: LocalLibraryContext,
): Promise<{ query: string; result: string }> {
  const query = typeof rawArgs.query === 'string' ? rawArgs.query : ''
  if (!context.loadLocalPaperContext) {
    return { query, result: '本地文献库搜索器未连接。' }
  }
  return {
    query,
    result: await context.loadLocalPaperContext(query),
  }
}
