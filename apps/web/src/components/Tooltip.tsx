import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  maxWidth?: number
}

export function Tooltip({ content, children, maxWidth = 340 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; placeAbove: boolean } | null>(null)
  const triggerRef = useRef<HTMLSpanElement | null>(null)

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spacing = 8
    const estimatedHeight = 70

    // If too close to viewport top (< 90px), place below the element to avoid getting clipped by screen
    const placeAbove = rect.top >= estimatedHeight + spacing + 20

    const targetTop = placeAbove ? rect.top - spacing : rect.bottom + spacing
    const halfWidth = maxWidth / 2
    const minLeft = halfWidth + 16
    const maxLeft = window.innerWidth - halfWidth - 16
    const center = rect.left + rect.width / 2
    const targetLeft = Math.max(minLeft, Math.min(maxLeft, center))

    setPosition({
      top: targetTop,
      left: targetLeft,
      placeAbove,
    })
  }, [maxWidth])

  const handleMouseEnter = () => {
    calculatePosition()
    setVisible(true)
  }

  const handleMouseLeave = () => {
    setVisible(false)
  }

  useEffect(() => {
    if (!visible) return

    const handleScrollOrResize = () => {
      calculatePosition()
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [visible, calculatePosition])

  if (!content) {
    return <>{children}</>
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="tooltip-trigger"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>
      {visible &&
        position &&
        createPortal(
          <div
            className={`portal-tooltip ${position.placeAbove ? 'portal-tooltip-above' : 'portal-tooltip-below'}`}
            style={{
              position: 'fixed',
              top: position.placeAbove ? undefined : position.top,
              bottom: position.placeAbove ? window.innerHeight - position.top : undefined,
              left: position.left,
              transform: 'translateX(-50%)',
              maxWidth,
              zIndex: 999999,
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  )
}
