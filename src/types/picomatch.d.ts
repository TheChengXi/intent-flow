declare module 'picomatch' {
  type Picomatch = (pattern: string | string[], options?: { dot?: boolean }) => (path: string) => boolean;
  const picomatch: Picomatch;
  export default picomatch;
}
