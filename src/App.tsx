import * as Y from 'yjs'
import './App.css'
import { equals } from 'ramda'
import { useRef, useSyncExternalStore } from 'react'

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
      <h1>Rsbuild with React</h1>
      <p>Start building amazing things with Rsbuild.</p>
      <h1>Internal State</h1>
      <pre>{JSON.stringify(text, null, 2)}</pre>
    </main>
  )
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
