import * as Y from 'yjs'
import './App.css'
import { equals } from 'ramda'
import {
  useRef,
  useSyncExternalStore,
  useCallback,
  useEffect,
  useLayoutEffect,
  type KeyboardEventHandler,
} from 'react'
import clsx from 'clsx'

const ydoc = new Y.Doc()
const ystate = ydoc.getMap('state')
const ytext = ydoc.getText('richtext')

ytext.insert(0, 'Hello World! ')
ytext.format(6, 5, { bold: true })
ytext.insertEmbed(ytext.length, {
  type: 'link',
  href: 'https://example.com',
  content: 'This is a link',
})

export default function App() {
  const prevState = useRef<{ text: RichText; cursor: Cursor | null }>(null)
  const { text, cursor } = useSyncExternalStore(
    (callback) => {
      ytext.observe(callback)
      ystate.observe(callback)

      return () => {
        ytext.unobserve(callback)
        ystate.unobserve(callback)
      }
    },
    () => {
      const text = ytext.toDelta() as RichText
      const cursor = ystate.get('cursor') as Cursor | null
      const state = { text, cursor }

      if (prevState.current && equals(prevState.current, state)) {
        return prevState.current
      }

      prevState.current = state
      return state
    },
  )

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    const newCursor = getCursor(selection)

    if (!equals(cursor, newCursor)) {
      ystate.set('cursor', newCursor)
    }
  }, [cursor])

  const handleKeyDown: KeyboardEventHandler = useCallback(
    (event) => {
      if (cursor == null) return
      if (event.key.startsWith('Arrow')) return
      if (event.ctrlKey && event.key === 'r') return

      const { start, end } = cursor

      event.preventDefault()

      if (event.key === 'Backspace') return
      if (event.key === 'Delete') return
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.length === 1
      ) {
        if (cursor.isCollapsed) {
          if (start.type === 'text') {
            ytext.insert(start.index, event.key)
            ystate.set('cursor', {
              start: {
                ...start,
                index: start.index + 1,
                offset: start.offset + 1,
              },
              end: { ...end, index: end.index + 1, offset: end.offset + 1 },
              isCollapsed: true,
            })
          }
        }
      }
    },
    [cursor],
  )

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [handleSelectionChange])

  useLayoutEffect(() => {
    const selection = window.getSelection()

    if (selection == null) return
    if (equals(getCursor(selection), cursor) && selection.rangeCount === 1)
      return

    selection.removeAllRanges()

    const range = getRange(cursor)

    if (range == null) return

    selection.addRange(range)
  }, [cursor])

  useEffect(() => {
    ystate.set('cursor', {
      start: { type: 'text', index: 0, id: '0', offset: 0 },
      end: { type: 'text', index: 0, id: '0', offset: 0 },
      isCollapsed: true,
    })
  }, [])

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
        onKeyDown={handleKeyDown}
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

function getRange(cursor: Cursor | null): Range | null {
  if (cursor == null) return null

  const { start, end } = cursor
  const startPosition = getDomPosition(start)
  const endPosition = getDomPosition(end)

  if (startPosition == null || endPosition == null) return null

  const range = document.createRange()
  range.setStart(startPosition.node, startPosition.offset)
  range.setEnd(endPosition.node, endPosition.offset)

  return range
}

function getDomPosition(
  position: Position,
): { node: Node; offset: number } | null {
  const { id, offset } = position
  const node = document.querySelector(
    `#richtext > span[data-id="${id}"]`,
  )?.firstChild

  if (node == null) return null

  return { node, offset }
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
