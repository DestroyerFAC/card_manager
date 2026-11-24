/** FormData values can be File objects; text inputs must only ever yield strings. */
export function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}
