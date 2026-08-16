import { createElement, Fragment, type ReactNode } from 'react'
import { asset } from './asset'

// ---------------------------------------------------------------------------
// Converts a trusted HTML string into a React element tree, replacing `{{n}}`
// tokens with a caller-supplied node (an input for question n). Unlike mounting
// inputs into innerHTML via portals, the result is fully React-managed, so it
// is stable across re-renders and works under StrictMode. Run inside useMemo so
// the generated keys stay stable.
// ---------------------------------------------------------------------------

const ATTR_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'col'])

function styleToObject(style: string): Record<string, string> {
  const obj: Record<string, string> = {}
  for (const rule of style.split(';')) {
    const idx = rule.indexOf(':')
    if (idx < 0) continue
    const prop = rule.slice(0, idx).trim()
    const val = rule.slice(idx + 1).trim()
    if (!prop) continue
    const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    obj[camel] = val
  }
  return obj
}

function splitText(text: string, gapRender: (n: number) => ReactNode, keyer: () => number): ReactNode {
  if (!text.includes('{{')) return text
  const parts: ReactNode[] = []
  const re = /\{\{(\d+)\}\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const n = Number(m[1])
    parts.push(<Fragment key={keyer()}>{gapRender(n)}</Fragment>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <Fragment key={keyer()}>{parts}</Fragment>
}

function convert(node: Node, gapRender: (n: number) => ReactNode, keyer: () => number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return splitText(node.textContent ?? '', gapRender, keyer)
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    const props: Record<string, unknown> = { key: keyer() }
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === 'style') {
        props.style = styleToObject(attr.value)
      } else if (tag === 'img' && attr.name.toLowerCase() === 'src') {
        // Inline completion layouts may contain diagrams/tables as images.
        // Resolve relative app assets while preserving http/data/blob sources.
        props.src = asset(attr.value)
      } else {
        props[ATTR_MAP[attr.name] ?? attr.name] = attr.value
      }
    }
    if (VOID_TAGS.has(tag)) return createElement(tag, props)
    const children = Array.from(el.childNodes).map((c) => convert(c, gapRender, keyer))
    return createElement(tag, props, ...children)
  }
  return null
}

export function htmlToReact(html: string, gapRender: (n: number) => ReactNode): ReactNode {
  let k = 0
  const keyer = () => k++
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return null
  return <>{Array.from(root.childNodes).map((c) => convert(c, gapRender, keyer))}</>
}
