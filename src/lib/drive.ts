// Pure helpers for the Google Drive backup. The network code is in src/features/backup/googleDrive.ts.

export const DRIVE_FOLDER_NAME = 'Daily Tracker backups'
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
// Only lets the app see and change files it created itself, never the rest of your Drive.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

const pad = (n: number) => String(n).padStart(2, '0')

// Local date and time, so several backups on one day get different names.
export const driveBackupName = (d: Date) =>
  `daily-tracker-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`

// Drive search queries put values in single quotes, so quotes and backslashes need escaping.
export const driveQuoted = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export const folderQuery = (name = DRIVE_FOLDER_NAME) =>
  `name = ${driveQuoted(name)} and mimeType = ${driveQuoted(DRIVE_FOLDER_MIME)} and trashed = false`

export const backupsQuery = (folderId: string) =>
  `${driveQuoted(folderId)} in parents and trashed = false and mimeType = 'application/json'`

// Body for Drive's multipart upload: the file's metadata and its content in one request.
export function multipartBody(metadata: object, content: string, boundary: string): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

export interface DriveFile { id: string; name: string; modifiedTime: string; size?: string }

// Turns a failed Drive or sign-in response into a sentence for the person using the app.
export function driveErrorMessage(status: number, body?: { error?: { message?: string } }): string {
  if (status === 401) return 'Your Google sign-in has expired. Try again to sign in.'
  if (status === 403) return `Google Drive refused the request${body?.error?.message ? `: ${body.error.message}` : '.'}`
  if (status === 404) return 'That backup is no longer in Google Drive.'
  if (status >= 500) return 'Google Drive is having problems right now. Try again in a minute.'
  return `Google Drive request failed (${status})${body?.error?.message ? `: ${body.error.message}` : '.'}`
}
