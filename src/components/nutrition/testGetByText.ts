/**
 * Minimal getByText (RTL-style) without adding @testing-library/react.
 * Throws if no element whose trimmed textContent equals or contains `text`.
 */
export function getByText(
  container: ParentNode,
  text: string,
  opts?: { exact?: boolean },
): HTMLElement {
  const exact = opts?.exact !== false
  const nodes = [...container.querySelectorAll('*')] as HTMLElement[]
  const match = nodes.find((el) => {
    const t = el.textContent?.trim() ?? ''
    if (exact) {
      // Prefer leaf-ish: own text equals, or element text equals exactly.
      if (t === text) {
        const hasElementChildWithSame = [...el.children].some(
          (c) => (c.textContent?.trim() ?? '') === text,
        )
        return !hasElementChildWithSame
      }
      return false
    }
    return t.includes(text)
  })
  if (!match) {
    throw new Error(`Unable to find an element with text: ${JSON.stringify(text)}`)
  }
  return match
}

export function queryByText(
  container: ParentNode,
  text: string,
  opts?: { exact?: boolean },
): HTMLElement | null {
  try {
    return getByText(container, text, opts)
  } catch {
    return null
  }
}
