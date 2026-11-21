import { describe, expect, it } from 'vitest';
import { readRepoText } from '../support/files';
import { busMarkerSvg } from '../../src/view/vehicles';

describe("today's bar marker", () => {
  const markup = busMarkerSvg({ width: 28 });
  const host = document.createElement('div');
  host.innerHTML = markup;

  it('is a flat bus with no glow, pole or wire, at 28 px', () => {
    expect(markup).not.toMatch(/glow|filter/);
    for (const part of ['pole', 'wire', 'shoe', 'rope']) expect(host.querySelectorAll(`[data-part="${part}"]`).length, part).toBe(0);
    expect(host.querySelector('svg')?.getAttribute('width')).toBe('28');
    expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('takes the today colour token through the bus body class', () => {
    expect(host.querySelector('.b-body')).not.toBeNull();
    const css = readRepoText('web/src/styles/vehicles.css');
    expect(/\.b-body\s*\{[^}]*fill:\s*var\(--today\)/.test(css)).toBe(true);
  });
});
