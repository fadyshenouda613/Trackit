import { useEffect, useState } from 'react'

/**
 * Whether the machine thinks it has a link. `navigator.onLine` is the most
 * the renderer can honestly know — it says nothing about whether the server
 * is up — so it is used to disable an action that cannot possibly work and
 * to say why, never to promise that one will.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = (): void => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
