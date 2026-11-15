// Google Drive backup: sign-in through Google Identity Services, then plain Drive REST calls.
// The app only ever asks for the drive.file permission, so it can see the files it created and nothing else.
import { backupsQuery, DRIVE_FOLDER_MIME, DRIVE_FOLDER_NAME, DRIVE_SCOPE, driveErrorMessage, folderQuery, multipartBody, type DriveFile } from '../../lib/drive'

// Set in .env (committed; .env.local can override it on one machine). See the README. Without it the Google Drive buttons are hidden.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
export const driveConfigured = () => CLIENT_ID.length > 0

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime'

// The small part of the Google Identity Services API that the app uses.
interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string }) => void }
interface Gis {
  accounts: { oauth2: {
    initTokenClient: (c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string; message?: string }) => void }) => TokenClient
    revoke: (token: string, done?: () => void) => void
  } }
}
declare global { interface Window { google?: Gis } }

let loading: Promise<void> | null = null

// Loads Google's sign-in script once. Call it early (when Settings opens) so a later click can open the
// sign-in popup straight away; browsers block popups that don't come directly from a click.
export function loadGoogleSignIn(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = GIS_SRC
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { loading = null; reject(new Error('Could not load Google sign-in. Check your internet connection.')) }
      document.head.appendChild(s)
    })
  }
  return loading
}

// The access token lives in memory only, so a reload means signing in again. It is never stored or backed up.
let token: { value: string; expiresAt: number } | null = null
let tokenClient: TokenClient | null = null
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null

export const isSignedIn = () => !!token && token.expiresAt > Date.now()

// Opens Google's sign-in and consent popup when needed. Must be called from a click.
export async function getAccessToken(chooseAccount = false): Promise<string> {
  if (!chooseAccount && isSignedIn()) return token!.value
  if (!driveConfigured()) throw new Error('Google Drive is not set up for this copy of the app.')
  if (!navigator.onLine) throw new Error('You are offline. Connect to the internet to use Google Drive.')
  await loadGoogleSignIn()
  const gis = window.google!.accounts.oauth2
  if (!tokenClient) {
    tokenClient = gis.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: r => {
        const p = pending; pending = null
        if (!p) return
        if (r.error || !r.access_token) return p.reject(new Error(r.error === 'access_denied' ? 'Google Drive access was not allowed.' : `Google sign-in failed: ${r.error_description ?? r.error ?? 'no token'}`))
        // Treat the token as expired a minute early so a request never starts with a token about to lapse.
        token = { value: r.access_token, expiresAt: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 }
        p.resolve(r.access_token)
      },
      error_callback: e => {
        const p = pending; pending = null
        p?.reject(new Error(e.type === 'popup_closed' ? 'Google sign-in was closed before it finished.'
          : e.type === 'popup_failed_to_open' ? 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.'
          : `Google sign-in failed: ${e.message ?? e.type}`))
      },
    })
  }
  pending?.reject(new Error('Google sign-in was restarted.'))
  return new Promise<string>((resolve, reject) => {
    pending = { resolve, reject }
    // First time (or "use another account"): show the account chooser. Later: reuse the account quietly when Google can.
    tokenClient!.requestAccessToken({ prompt: chooseAccount || !token ? 'select_account' : '' })
  })
}

export function signOut() {
  if (token && window.google) window.google.accounts.oauth2.revoke(token.value)
  token = null
}

async function call<T>(url: string, init: RequestInit = {}, as: 'json' | 'text' = 'json'): Promise<T> {
  const access = await getAccessToken()
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${access}` } })
  } catch {
    throw new Error('Could not reach Google Drive. Check your internet connection.')
  }
  if (res.status === 401) token = null
  if (!res.ok) throw new Error(driveErrorMessage(res.status, await res.json().catch(() => undefined)))
  return (as === 'json' ? res.json() : res.text()) as Promise<T>
}

// Finds the app's backup folder, or creates it on first use.
async function backupFolderId(create: boolean): Promise<string | null> {
  const q = encodeURIComponent(folderQuery())
  const found = await call<{ files: { id: string }[] }>(`${API}/files?q=${q}&fields=files(id)&spaces=drive&pageSize=1`)
  if (found.files[0]) return found.files[0].id
  if (!create) return null
  const made = await call<{ id: string }>(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: DRIVE_FOLDER_MIME }),
  })
  return made.id
}

export async function uploadBackup(name: string, content: string): Promise<DriveFile> {
  const folder = (await backupFolderId(true))!
  const boundary = `dtt-${crypto.randomUUID()}`
  return call<DriveFile>(UPLOAD, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipartBody({ name, mimeType: 'application/json', parents: [folder] }, content, boundary),
  })
}

// The app's backups, newest first.
export async function listBackups(): Promise<DriveFile[]> {
  const folder = await backupFolderId(false)
  if (!folder) return []
  const q = encodeURIComponent(backupsQuery(folder))
  const r = await call<{ files: DriveFile[] }>(`${API}/files?q=${q}&orderBy=modifiedTime desc&pageSize=50&spaces=drive&fields=files(id,name,modifiedTime,size)`)
  return r.files
}

export const downloadBackup = (id: string) => call<string>(`${API}/files/${encodeURIComponent(id)}?alt=media`, {}, 'text')
