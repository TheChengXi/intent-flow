import 'leafer-ui'

declare module 'leafer-ui' {
  interface Group {
    __isInteractive?: boolean
  }
  interface Text {
    backgroundColor?: string
  }
}
