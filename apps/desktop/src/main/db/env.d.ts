/*
 * The two pieces of Vite the main process leans on: importing a file as its
 * text (`?raw`) and listing a directory at build time (`import.meta.glob`).
 * Declared here rather than by pulling in `vite/client`, which would bring
 * the renderer's asset and DOM-flavoured declarations into a Node build.
 */
declare module '*.sql?raw' {
  const sql: string
  export default sql
}

interface ImportMeta {
  glob<T = unknown>(
    pattern: string,
    options?: { eager?: boolean; import?: string; query?: string }
  ): Record<string, T>
  /**
   * What electron-vite inlines at build time. Only variables prefixed
   * MAIN_VITE_ reach the main process; MAIN_VITE_SERVER_URL is how a
   * packaged build knows where the account server is.
   */
  readonly env: { readonly MAIN_VITE_SERVER_URL?: string; readonly DEV: boolean }
}
