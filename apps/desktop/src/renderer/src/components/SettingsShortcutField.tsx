import { useEffect, useState, type JSX } from 'react'
import { ledger } from '../bridge'
import { formatShortcut } from './settings-data'

type SettingsShortcutFieldProps = {
  /** An Electron accelerator, e.g. `CommandOrControl+Shift+S`. */
  value: string
  onChange: (accelerator: string) => void
}

/* Keys that only ever arrive as part of a chord; pressing one alone is the user
   still assembling the shortcut, not choosing it. */
const MODIFIERS = ['Control', 'Meta', 'Alt', 'Shift', 'AltGraph', 'CapsLock']

/** The named keys worth allowing on their own end of a chord. */
const NAMED = /^(F\d{1,2}|Arrow(Up|Down|Left|Right)|Space|Tab|Enter|Backspace|Delete|Home|End|PageUp|PageDown)$/

function acceleratorFrom(event: KeyboardEvent): string | null {
  if (MODIFIERS.includes(event.key)) return null

  const parts: string[] = []
  /* Cmd on a Mac and Ctrl everywhere else are the same shortcut, and Electron
     spells that CommandOrControl. */
  if (event.metaKey || event.ctrlKey) parts.push('CommandOrControl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')

  const key = event.key === ' ' ? 'Space' : event.key
  if (key.length === 1) parts.push(key.toUpperCase())
  else if (NAMED.test(key)) parts.push(key)
  else return null

  return parts.join('+')
}

/**
 * A field you set by using it: click, then press the chord you want.
 *
 * A shortcut with no modifier is refused rather than accepted and later
 * regretted — a global binding on a bare S fires while you are typing a client
 * name into any other window on the machine. The refusal is stated in grey and
 * the field stays armed, because it is a correction and not a failure.
 */
export function SettingsShortcutField({
  value,
  onChange
}: SettingsShortcutFieldProps): JSX.Element {
  const [capturing, setCapturing] = useState(false)
  const [rejected, setRejected] = useState(false)

  useEffect(() => {
    if (!capturing) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Tab') return
      event.preventDefault()

      if (event.key === 'Escape') {
        setCapturing(false)
        setRejected(false)
        return
      }

      const next = acceleratorFrom(event)
      if (!next) return

      /* Shift alone does not make a chord: Shift+S is S. */
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        setRejected(true)
        return
      }

      onChange(next)
      setCapturing(false)
      setRejected(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [capturing, onChange])

  const keys = formatShortcut(value, ledger.platform)

  return (
    <div className="shortcut">
      <button
        type="button"
        className={capturing ? 'shortcut__field shortcut__field--armed' : 'shortcut__field'}
        aria-label="Global start and stop shortcut"
        onClick={() => {
          setCapturing((current) => !current)
          setRejected(false)
        }}
        onBlur={() => {
          setCapturing(false)
          setRejected(false)
        }}
      >
        {capturing ? (
          <span className="shortcut__prompt">Press a shortcut…</span>
        ) : (
          keys.map((key) => (
            <span key={key} className="shortcut__key">
              {key}
            </span>
          ))
        )}
      </button>

      <span className="shortcut__note">
        {rejected
          ? 'Needs at least one modifier — a bare key would fire while you type.'
          : capturing
            ? 'Esc to cancel.'
            : 'Starts or stops the timer on your last project, even when Trackit is behind another window.'}
      </span>
    </div>
  )
}
