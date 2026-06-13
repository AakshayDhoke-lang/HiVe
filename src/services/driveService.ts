import { google } from 'googleapis';
import { Readable } from 'stream';
import { decrypt } from '../config/encryption';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;

/**
 * Creates a new Google OAuth2 Client.
 */
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL
  );
}

/**
 * Creates an authorized Google Drive API client using the user's encrypted refresh token.
 */
export function getDriveClient(encryptedRefreshToken: string) {
  const oauth2Client = getOAuth2Client();
  const refreshToken = decrypt(encryptedRefreshToken);
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Helper to find or create the dedicated "HiVe" folder in the user's Google Drive.
 */
async function getOrCreateHiveFolder(drive: any): Promise<string> {
  // Search for an existing non-trashed folder named "HiVe"
  const response = await drive.files.list({
    q: "name = 'HiVe' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const files = response.data.files || [];
  if (files.length > 0) {
    return files[0].id;
  }

  // Create "HiVe" folder if it doesn't exist
  const folderMetadata = {
    name: 'HiVe',
    mimeType: 'application/vnd.google-apps.folder',
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id',
  });

  if (!folder.data.id) {
    throw new Error('Failed to create HiVe directory in Google Drive');
  }

  return folder.data.id;
}

/**
 * Uploads a file buffer to the "HiVe" folder in Google Drive.
 * Returns the Google Drive File ID.
 */
export async function uploadPdfToDrive(
  encryptedRefreshToken: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const drive = getDriveClient(encryptedRefreshToken);
  const folderId = await getOrCreateHiveFolder(drive);

  // Convert buffer to stream for googleapis compatibility
  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  const fileMetadata = {
    name: filename,
    parents: [folderId],
  };

  const media = {
    mimeType: mimeType,
    body: bufferStream,
  };

  const options = fileBuffer.length > 5 * 1024 * 1024 ? { resumable: true } as any : {};

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id',
  }, options);

  const data = file.data as any;
  if (!data.id) {
    throw new Error('Failed to upload file to Google Drive');
  }

  return data.id;
}

/**
 * Moves a file to trash in Google Drive.
 */
export async function deletePdfFromDrive(
  encryptedRefreshToken: string,
  driveFileId: string
): Promise<void> {
  const drive = getDriveClient(encryptedRefreshToken);
  
  await drive.files.update({
    fileId: driveFileId,
    requestBody: {
      trashed: true,
    },
  });
}

/**
 * Downloads a file from Google Drive and returns it as a Buffer.
 * Used by the raw PDF serving endpoint.
 */
export async function downloadPdfFromDrive(
  encryptedRefreshToken: string,
  driveFileId: string
): Promise<Buffer> {
  const drive = getDriveClient(encryptedRefreshToken);

  const response = await drive.files.get(
    { fileId: driveFileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}
