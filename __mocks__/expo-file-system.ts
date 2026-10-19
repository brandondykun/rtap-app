/** In-memory expo-file-system for tests: tracks which file URIs exist. */
export const __files = new Set<string>();

const join = (segments: (string | { uri: string })[]) => segments.map((s) => (typeof s === 'string' ? s : s.uri)).join('/');

export class Directory {
  uri: string;
  constructor(...segments: (string | { uri: string })[]) {
    this.uri = join(segments);
  }
  get name() {
    return this.uri.split('/').pop() ?? '';
  }
  get exists() {
    return true;
  }
  create = jest.fn();
  /** Direct children: files directly in this folder, and subfolders (by path prefix). */
  list() {
    const prefix = `${this.uri}/`;
    const names = new Set<string>();
    for (const f of __files) if (f.startsWith(prefix)) names.add(f.slice(prefix.length).split('/')[0]);
    return [...names].map((n) => ([...__files].some((f) => f.startsWith(`${prefix}${n}/`)) ? new Directory(this, n) : new File(this, n)));
  }
  delete() {
    for (const f of [...__files]) if (f.startsWith(`${this.uri}/`)) __files.delete(f);
  }
}

export class File {
  uri: string;
  constructor(...segments: (string | { uri: string })[]) {
    this.uri = join(segments);
  }
  get name() {
    return this.uri.split('/').pop() ?? '';
  }
  get exists() {
    return __files.has(this.uri);
  }
  write(_content: unknown) {
    __files.add(this.uri);
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

export const Paths = { document: new Directory('file:///docs'), cache: new Directory('file:///cache') };
