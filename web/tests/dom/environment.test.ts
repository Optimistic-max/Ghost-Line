import { describe, expect, it } from 'vitest';

describe('dom test project', () => {
  it('runs tests under tests/dom in jsdom', () => {
    const p = document.createElement('p');
    p.textContent = 'Ghost Line';
    document.body.append(p);
    expect(document.body.textContent).toContain('Ghost Line');
  });
});
