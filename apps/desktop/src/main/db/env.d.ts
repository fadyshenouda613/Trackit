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
}
