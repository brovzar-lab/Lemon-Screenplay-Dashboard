import { useState } from 'react'
import { toggleCeoWatch } from '../lib/firestore'
import { useTitleStore } from '../store/titleStore'

interface Props {
  titleId: string
  watched: boolean
  className?: string
}

export function StarToggle({ titleId, watched, className = '' }: Props) {
  const [pending, setPending] = useState(false)
  const refresh = useTitleStore(s => s.refresh)

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (pending) return
    setPending(true)
    try {
      await toggleCeoWatch(titleId, !watched)
      await refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      className={[
        'transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lemon-400/50 rounded',
        pending ? 'opacity-40' : '',
        className,
      ].join(' ')}
    >
      {watched ? (
        <span className="text-lemon-400 text-sm">★</span>
      ) : (
        <span className="text-gray-700 hover:text-gray-400 text-sm">☆</span>
      )}
    </button>
  )
}
