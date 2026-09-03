import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Bundled, not fetched: the renderer loads from file:// with no guaranteed
// network. The variable cuts carry weight 450, which the `ui` type token needs.
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/jetbrains-mono'

import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'
import './styles/print.css'

import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('Renderer root element is missing')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
