import puppeteer, { type Browser } from 'puppeteer'

/*
 * Printing a page to PDF.
 *
 * One browser per process, launched the first time it is needed and kept:
 * a launch costs seconds, a page costs milliseconds. Each render is its
 * own page, closed whatever happens. A browser that goes away — a crash, a
 * kill — is forgotten, so the next render launches a fresh one rather than
 * failing forever on a dead handle.
 */

export type PdfRenderer = {
  /** A4, backgrounds on, the page's own @page rule honoured. */
  render: (html: string) => Promise<Uint8Array>
  /** Closes the browser if one is open. Awaited on shutdown. */
  close: () => Promise<void>
}

export type PdfRendererOptions = {
  /** Extra flags for the browser — `--no-sandbox` inside a container that has none. */
  args?: string[]
}

export function createPdfRenderer(options: PdfRendererOptions = {}): PdfRenderer {
  let browser: Promise<Browser> | null = null

  const open = (): Promise<Browser> => {
    if (browser) return browser
    const launching = puppeteer.launch({ headless: true, args: options.args ?? [] })
    browser = launching
    launching
      .then((opened) => {
        opened.once('disconnected', () => {
          if (browser === launching) browser = null
        })
      })
      .catch(() => {
        if (browser === launching) browser = null
      })
    return launching
  }

  return {
    render: async (html) => {
      const page = await (await open()).newPage()
      try {
        await page.setContent(html, { waitUntil: 'load' })
        /* The embedded face is decoded asynchronously; printing before it is
           ready falls back to whatever the machine has. */
        await page.evaluate('document.fonts.ready')
        return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
      } finally {
        await page.close().catch(() => undefined)
      }
    },
    close: async () => {
      const open = browser
      browser = null
      if (!open) return
      await open.then((opened) => opened.close()).catch(() => undefined)
    }
  }
}
