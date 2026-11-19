// Route names joined for the frequency sentence (R8.5): one name alone; two with
// " and "; more with commas and "and". The names are shown as given.
import { LIST_AND } from '../copy/copy';

export function joinNames(names: readonly string[]): string {
  const last = names.at(-1);
  if (last === undefined) return '';
  const rest = names.slice(0, -1);
  return rest.length === 0 ? last : `${rest.join(', ')} ${LIST_AND} ${last}`;
}
