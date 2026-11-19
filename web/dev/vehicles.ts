// Dev only, not part of the build (Vite builds index.html alone). Open
// /Ghost-Line/dev/vehicles.html on the dev server to see the vehicles at the
// sizes of ui.md, beside docs/planning/ui-mockups/18-trolley-sheet.png.
// The route number is read from the real index.json, as on the race screen.
import { routeNumberOf } from '../src/format/line';
import { busSvg, markerSvg, trolleySvg, vehicleWidths } from '../src/view/vehicles';

const DETAIL_WIDTH = 360;

async function routeNumber(): Promise<string | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/index.json`);
    const index = (await response.json()) as { line?: unknown };
    return typeof index.line === 'string' ? routeNumberOf(index.line) : null;
  } catch {
    return null;
  }
}

function figure(markup: string, caption: string): string {
  return `<figure>${markup}<figcaption>${caption}</figcaption></figure>`;
}

const number = await routeNumber();
const phone = vehicleWidths('phone');
const desktop = vehicleWidths('desktop');

const sheet = document.getElementById('sheet');
if (sheet) {
  sheet.innerHTML = [
    figure(trolleySvg({ routeNumber: number, width: DETAIL_WIDTH }), `${DETAIL_WIDTH} px (detail)`),
    figure(trolleySvg({ routeNumber: number, width: desktop.trolleyRacing }), `${desktop.trolleyRacing} px (desktop)`),
    figure(trolleySvg({ routeNumber: number, width: phone.trolleyRacing }), `${phone.trolleyRacing} px (phone, racing)`),
    figure(trolleySvg({ routeNumber: number, width: phone.trolleyFinished }), `${phone.trolleyFinished} px (phone, finished)`),
    figure(trolleySvg({ routeNumber: null, width: phone.trolleyFinished }), `${phone.trolleyFinished} px, no route number (data error)`),
    figure(markerSvg({ width: desktop.marker }), `${desktop.marker} px (map, desktop)`),
    figure(markerSvg({ width: phone.marker }), `${phone.marker} px (map, phone)`),
    figure(busSvg({ width: desktop.bus }), `${desktop.bus} px bus (desktop)`),
    figure(busSvg({ width: phone.bus }), `${phone.bus} px bus (phone)`),
  ].join('');
}
