import { useState, useEffect, useRef } from 'react'
import { resolveUserId, getInventory, fetchItemMarketData, groupInventory } from '../utils/api'

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map()

export function useInventory(username) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const cancelled = useRef(false)

  useEffect(() => {
    if (!username) return
    cancelled.current = false

    const cached = cache.get(username)
    if (cached) {
      setItems(cached.items)
      if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) return
    }

    setLoading(true)
    setError('')

    ;(async () => {
      try {
        const { id } = await resolveUserId(username)
        const [rawItems, { items: marketData }] = await Promise.all([
          getInventory(id),
          fetchItemMarketData(),
        ])
        const grouped = groupInventory(rawItems, marketData)
        cache.set(username, { items: grouped, fetchedAt: Date.now() })
        if (!cancelled.current) setItems(grouped)
      } catch (e) {
        if (!cancelled.current) setError(e.message)
      } finally {
        if (!cancelled.current) setLoading(false)
      }
    })()

    return () => { cancelled.current = true }
  }, [username])

  return { items, loading, error }
}
