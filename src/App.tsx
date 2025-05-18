import * as Y from 'yjs'
import './App.css'
import { equals } from 'ramda'
import { useRef, useSyncExternalStore } from 'react'
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

  return (
    <main className="prose p-10">
      <h1>Richtext element</h1>
      {renderContentEditable()}
      <h1>Internal State</h1>
      <pre>{JSON.stringify(text, null, 2)}</pre>
    </main>
  )

  function renderContentEditable() {
    return (
      <p
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

    for (const insert of text) {
      const classNames = clsx(
        insert.attributes?.bold && 'font-bold',
        insert.attributes?.italic && 'italic',
      )

      if (typeof insert.insert === 'string') {
        spans.push(
          <span key={position} className={classNames} data-position={position}>
            {insert.insert}
          </span>,
        )
        position += insert.insert.length
      } else {
        spans.push(
          <span
            key={position}
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
