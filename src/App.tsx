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
      const isCollapsed = equals(start, end)
      const startType = getTypeFromInsert(text[start.stateIndex])

      event.preventDefault()

      if (event.key === 'Backspace' || event.key === 'Delete') {
        if (!isCollapsed) {
          ytext.delete(start.yjsIndex, end.yjsIndex - start.yjsIndex)
          ystate.set('cursor', { start, end: start })
        }
      } else if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.length === 1
      ) {
        if (isCollapsed) {
          if (startType === 'text') {
            ytext.insert(start.yjsIndex, event.key)
            ystate.set('cursor', {
              start: {
                ...start,
                index: start.yjsIndex + 1,
                offset: start.offset + 1,
              },
              end: { ...end, index: end.yjsIndex + 1, offset: end.offset + 1 },
            })
          }
        }
      }
    },
    [cursor, text],
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
  const { stateIndex, offset } = position
  const node = document.querySelector(
    `#richtext > span[data-id="${stateIndex}"]`,
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

  return anchorPosition.yjsIndex < focusPosition.yjsIndex
    ? { start: anchorPosition, end: focusPosition }
    : { start: focusPosition, end: anchorPosition }
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
  const stateIndex = Number.parseInt(id ?? '', 10)

  if (type !== 'text' && type !== 'link') return null
  if (position == null || id == null) return null

  const positionNr = Number.parseInt(position, 10)

  if (Number.isNaN(positionNr) || Number.isNaN(stateIndex)) return null

  const index = type === 'text' ? positionNr + offset : positionNr + 1

  return { yjsIndex: index, stateIndex, offset }
}

function getTypeFromInsert(insert: Insert): 'text' | 'link' {
  return typeof insert.insert === 'string' ? 'text' : 'link'
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
}

interface Position {
  yjsIndex: number
  stateIndex: number
  offset: number
}
