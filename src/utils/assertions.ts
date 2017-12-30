export function assertOne<T>(array: T[]): T {
  if (array.length !== 1) {
    throw new Error('Expected one, but got many.');
  }
  return array[0];
}
