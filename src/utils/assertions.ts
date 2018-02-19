export function assertOne<T>(array: T[]): T {
  if (array.length !== 1) {
    throw new Error('Expected one, but got many.');
  }
  return array[0];
}

export function assertDefined<T>(obj: T | undefined): T {
  if (obj == undefined) {
    throw new Error('Expected object to be defined, but object was undefined.');
  }
  return obj;
}
