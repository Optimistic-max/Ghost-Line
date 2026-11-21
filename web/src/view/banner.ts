// The share banner (R4.5, R4.6, mockups 08 and 20): a light pill over the top of
// the screen that slides in (200 ms), holds (5 s) and slides out (200 ms). The
// slide is the stylesheet's transition; with reduced motion it is removed and
// the banner simply appears and goes. It names the pair only, never a time.
import { TIMINGS } from '../config';
import { CLOSE } from '../copy/copy';
import { h } from './dom';

export type Banner = {
  show(text: string, onDone: () => void): void;
  hide(): void;
};

export function createBanner(
  root: HTMLElement,
  later: (callback: () => void, ms: number) => number,
  cancel: (handle: number) => void,
): Banner {
  let el: HTMLElement | null = null;
  let timer: number | null = null;
  const stop = (): void => {
    if (timer !== null) cancel(timer);
    timer = null;
  };
  return {
    show(text, onDone) {
      stop();
      // The close control clears the banner at once, whatever the hold timer is doing (Req 12.11).
      // The cross is drawn by the stylesheet, so the banner's text stays the copy string alone.
      const close = h('button', { type: 'button', class: 'banner-close', 'aria-label': CLOSE });
      close.addEventListener('click', () => {
        stop();
        onDone();
      });
      const banner = h('div', { class: 'banner', role: 'status' }, h('span', { class: 'banner-text' }, text), close);
      root.replaceChildren(banner);
      el = banner;
      // Read the layout once so the slide starts from above the screen.
      void banner.offsetWidth;
      banner.classList.add('is-open');
      // In, then the hold, then out.
      timer = later(() => {
        timer = later(onDone, TIMINGS.bannerHoldMs);
      }, TIMINGS.bannerSlideMs);
    },
    hide() {
      stop();
      const banner = el;
      el = null;
      if (!banner) return;
      banner.classList.remove('is-open');
      timer = later(() => {
        timer = null;
        banner.remove();
      }, TIMINGS.bannerSlideMs);
    },
  };
}
