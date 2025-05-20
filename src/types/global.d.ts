export {}

declare global {
  interface Window {
    mdc?: {
      autoInit?: () => void
    }
  }
}
