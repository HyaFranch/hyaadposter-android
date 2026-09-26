import { useRef, useEffect, useCallback } from 'react'

export function useNativePaste(onValue) {
  const elRef  = useRef(null)
  const cbRef  = useRef(onValue)

  useEffect(() => { cbRef.current = onValue }, [onValue])

  const setRef = useCallback(el => {

    if (elRef.current) {
      elRef.current.removeEventListener('input', elRef.current.__nativePasteHandler)
    }

    elRef.current = el

    if (!el) return

    const handler = () => {
      const val = el.value
      if (val !== undefined) cbRef.current(val)
    }

    el.__nativePasteHandler = handler

    el.addEventListener('input', handler)
  }, [])

  return setRef
}
