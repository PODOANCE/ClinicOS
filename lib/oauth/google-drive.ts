import { google } from 'googleapis'
import { getServiceAccountAuth } from './google-auth'

export function getDriveClient() {
  const auth = getServiceAccountAuth()
  return google.drive({ version: 'v3', auth })
}

export async function listFolderContents(folderId: string) {
  const drive = getDriveClient()
  const result = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, size, modifiedTime, createdTime)',
    pageSize: 100,
  })
  return result.data.files || []
}

export async function getFolderByName(name: string, parentId?: string): Promise<any> {
  const drive = getDriveClient()
  let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  if (parentId) {
    q += ` and '${parentId}' in parents`
  }
  const result = await drive.files.list({
    q,
    fields: 'files(id, name, webViewLink)',
    pageSize: 1,
  })
  return result.data.files?.[0] || null
}

export async function listPDFsInFolder(folderId: string, options?: { pageSize?: number; pageToken?: string }) {
  const drive = getDriveClient()
  const result = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
    fields: 'files(id, name, mimeType, webViewLink, size, modifiedTime, createdTime, parents), nextPageToken',
    pageSize: options?.pageSize || 50,
    pageToken: options?.pageToken,
  })
  return {
    files: result.data.files || [],
    nextPageToken: result.data.nextPageToken || null,
  }
}

export async function createFolder(name: string, parentId: string) {
  const drive = getDriveClient()
  const result = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name, webViewLink',
  })
  return result.data
}

export async function uploadFile(name: string, content: string, parentId: string) {
  const drive = getDriveClient()
  const result = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
    },
    media: {
      mimeType: 'text/plain',
      body: content,
    },
    fields: 'id, name, webViewLink',
  })
  return result.data
}

export async function readFile(fileId: string) {
  const drive = getDriveClient()
  const result = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  )
  return result.data
}

export async function downloadFileAsBuffer(fileId: string): Promise<Buffer> {
  const drive = getDriveClient()
  const result = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(result.data as ArrayBuffer)
}

export async function moveFile(fileId: string, newParentId: string, previousParentId: string) {
  const drive = getDriveClient()
  const result = await drive.files.update({
    fileId,
    addParents: newParentId,
    removeParents: previousParentId,
    fields: 'id, parents, webViewLink',
  })
  return result.data
}

export async function deleteFile(fileId: string) {
  const drive = getDriveClient()
  await drive.files.delete({ fileId })
}
