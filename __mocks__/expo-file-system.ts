/** In-memory expo-file-system for tests: tracks which file URIs exist. */
export const __files = new Set<string>();

const join = (segments: (string | { uri: string })[]) => segments.map((s) => (typeof s === 'string' ? s : s.uri)).join('/');

export class Directory {
  uri: string;
  constructor(...segments: (string | { uri: string })[]) {
    this.uri = join(segments);
  }
  get exists() {
    return true;
  }
  create = jest.fn();
}

export class File {
  uri: string;
  constructor(...segments: (string | { uri: string })[]) {
    this.uri = join(segments);
  }
  get exists() {
    return __files.has(this.uri);
  }
  delete() {
    __files.delete(this.uri);
  }
  move(destination: { uri: string }) {
    __files.delete(this.uri);
    __files.add(destination.uri);
    this.uri = destination.uri;
  }
}

export const Paths = { document: new Directory('file:///docs') };
