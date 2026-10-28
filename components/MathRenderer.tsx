"use client"

import katex from "katex"
import "katex/dist/katex.min.css"
import { useMemo } from "react"

interface MathRendererProps {
  children: string
  className?: string
}

const MATH_REGEX = /(\$\$([\s\S]*?)\$\$)|(\$([^$\n]*?)\$)/g

export function MathRenderer({ children, className }: MathRendererProps) {
  const rendered = useMemo(() => {
    if (!children) return null
    return parseAndRender(children)
  }, [children])

  const cls = className || "math-content"
  return <div className={cls}>{rendered}</div>
}

function parseAndRender(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyIndex = 0

  while ((match = MATH_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plainText = text.slice(lastIndex, match.index)
      if (plainText) {
        parts.push(<span key={`t-${keyIndex++}`}>{plainText}</span>)
      }
    }

    if (match[1]) {
      const formula = match[2].trim()
      try {
        const html = katex.renderToString(formula, {
          displayMode: true,
          throwOnError: false,
          output: "html",
        })
        parts.push(
          <div
            key={`b-${keyIndex++}`}
            className="katex-display my-3"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      } catch {
        parts.push(
          <span key={`bf-${keyIndex++}`} className="text-red-500 text-xs">
            $$ {formula} $$
          </span>
        )
      }
    } else if (match[3]) {
      const formula = match[4]
      try {
        const html = katex.renderToString(formula, {
          displayMode: false,
          throwOnError: false,
          output: "html",
        })
        parts.push(
          <span
            key={`i-${keyIndex++}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      } catch {
        parts.push(
          <span key={`if-${keyIndex++}`} className="text-red-500 text-xs">
            $ {formula} $
          </span>
        )
      }
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    parts.push(<span key={`t-${keyIndex++}`}>{remaining}</span>)
  }

  return parts.length === 0 ? text : parts
}
