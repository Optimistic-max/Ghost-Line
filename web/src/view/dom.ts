// A tiny helper for building DOM elements. No framework (tech.md).

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | boolean | null | undefined>;

/**
 * An element with attributes and children. An attribute set to true is written
 * empty; false, null and undefined are left out. "class" sets the class list.
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    el.setAttribute(name, value === true ? '' : value);
  }
  append(el, ...children);
  return el;
}

/** Append children, skipping empty ones; strings become text nodes. */
export function append(parent: Node, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === '') continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

/** An element holding trusted SVG markup built by vehicles.ts. */
export function fromMarkup(markup: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = markup;
  return template.content;
}

/** Set a CSS custom property to a number (layout fractions, sizes). */
export function setVar(el: HTMLElement, name: string, value: number | string): void {
  el.style.setProperty(name, String(value));
}
