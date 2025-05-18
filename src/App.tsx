import * as Y from 'yjs'
import './App.css'
import { equals } from 'ramda'
import {
  useRef,
  useSyncExternalStore,
  useState,
  useCallback,
  useEffect,
} from 'react'
import clsx from 'clsx'

const ydoc = new Y.Doc()
const ytext = ydoc.getText('richtext')

ytext.insert(0, 'Hello World! ')
ytext.format(6, 5, { bold: true })
ytext.insertEmbed(ytext.length, {
  type: 'link',
  href: 'https://example.com',
  content: 'This is a link',
})

export default function App() {
  const prevText = useRef<RichText>(null)
  const text = useSyncExternalStore(
    (callback) => {
      ytext.observe(callback)

      return () => {
        ytext.unobserve(callback)
      }
    },
    () => {
      const text = ytext.toDelta() as RichText

      if (prevText.current && equals(prevText.current, text)) {
        return prevText.current
      }

      prevText.current = text
      return text
    },
  )
  const [cursor, setCursor] = useState<Cursor | null>(null)

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    const newCursor = getCursor(selection)

    if (!equals(cursor, newCursor)) {
      setCursor(newCursor)
    }
  }, [cursor])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [handleSelectionChange])

  return (
    <main className="prose p-10">
      <h1>Richtext element</h1>
      {renderContentEditable()}
      <h1>Internal State</h1>
      <pre>{JSON.stringify({ cursor, text }, null, 2)}</pre>
    </main>
  )

  function renderContentEditable() {
    return (
      <p
        id="richtext"
        contentEditable
        suppressContentEditableWarning
        spellCheck="false"
        className="white-space-pre-wrap"
      >
        {renderText()}
      </p>
    )
  }

  function renderText() {
    const spans = []
    let position = 0

    for (let index = 0; index < text.length; index++) {
      const insert = text[index]
      const classNames = clsx(
        insert.attributes?.bold && 'font-bold',
        insert.attributes?.italic && 'italic',
      )

      if (typeof insert.insert === 'string') {
        spans.push(
          <span
            key={position}
            className={classNames}
            data-id={index}
            data-position={position}
            data-type="text"
          >
            {insert.insert}
          </span>,
        )
        position += insert.insert.length
      } else {
        spans.push(
          <span
            key={position}
            data-type="link"
            data-id={index}
            data-position={position}
            className={clsx(classNames, 'text-blue-500 underline')}
          >
            {insert.insert.content}
          </span>,
        )
        position += 1
      }
    }

    return spans
  }
}

function getCursor(selection: Selection | null): Cursor | null {
  if (selection == null) return null

  const { anchorNode, focusNode, anchorOffset, focusOffset } = selection
  const anchorPosition = getPosition(anchorNode, anchorOffset)
  const focusPosition = getPosition(focusNode, focusOffset)

  if (anchorPosition == null || focusPosition == null) return null

  const isCollapsed = equals(anchorPosition, focusPosition)

  return anchorPosition.index < focusPosition.index
    ? { start: anchorPosition, end: focusPosition, isCollapsed }
    : { start: focusPosition, end: anchorPosition, isCollapsed }
}

function getPosition(
  node: Node | null,
  offset: number | null,
): Position | null {
  if (node == null || offset == null) return null
  if (node.nodeType !== Node.TEXT_NODE) return null
  if (node.parentElement == null) return null
  if (node.parentElement?.parentElement?.id !== 'richtext') return null

  const { type, position, id } = node.parentElement.dataset

  if (type !== 'text' && type !== 'link') return null
  if (position == null || id == null) return null

  const positionNr = Number.parseInt(position, 10)

  if (Number.isNaN(positionNr)) return null

  const index = type === 'text' ? positionNr + offset : positionNr + 1

  return { type, index, id, offset }
}

type RichText = Insert[]

interface Insert {
  insert: string | LinkEmbed
  attributes?: { bold?: boolean; italic?: boolean }
}

interface LinkEmbed {
  type: 'link'
  href: string
  content: string
}

interface Cursor {
  start: Position
  end: Position
  isCollapsed: boolean
}

interface Position {
  type: 'text' | 'link'
  index: number
  id: string
  offset: number
}
