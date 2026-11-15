/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth client ID for Google Drive backup (set in .env, or .env.local to override). Leave unset to hide the Google Drive buttons. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
