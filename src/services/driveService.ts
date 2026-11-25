import { getAccessToken } from '../firebase';

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime: string;
    size?: string;
    iconLink?: string;
    thumbnailLink?: string;
    webViewLink?: string;
    webContentLink?: string;
    shared?: boolean;
    owners?: Array<{
        displayName: string;
        emailAddress: string;
        photoLink?: string;
    }>;
    parents?: string[];
}

export interface DriveQuota {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
    usageInDriveTrash?: string;
}

export interface DriveAbout {
    user?: {
        displayName: string;
        emailAddress: string;
        photoLink?: string;
    };
    storageQuota?: DriveQuota;
}

/**
 * Formats byte counts into human-readable size strings.
 */
export function formatBytes(bytes: number | string | undefined, decimals = 1): string {
    if (bytes === undefined || bytes === null || bytes === '') return '-';
    const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(num) || num === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Returns a human-friendly label and icon descriptor for a Drive MIME type.
 */
export function getMimeTypeInfo(mimeType: string): { label: string; typeClass: string; isFolder: boolean } {
    if (mimeType === 'application/vnd.google-apps.folder') {
        return { label: 'Folder', typeClass: 'mime--folder', isFolder: true };
    }
    if (mimeType.includes('document') || mimeType === 'application/vnd.google-apps.document') {
        return { label: 'Google Doc', typeClass: 'mime--doc', isFolder: false };
    }
    if (mimeType.includes('spreadsheet') || mimeType === 'application/vnd.google-apps.spreadsheet') {
        return { label: 'Google Sheet', typeClass: 'mime--sheet', isFolder: false };
    }
    if (mimeType.includes('presentation') || mimeType === 'application/vnd.google-apps.presentation') {
        return { label: 'Google Slides', typeClass: 'mime--slides', isFolder: false };
    }
    if (mimeType === 'application/pdf') {
        return { label: 'PDF Document', typeClass: 'mime--pdf', isFolder: false };
    }
    if (mimeType.startsWith('image/')) {
        return { label: 'Image', typeClass: 'mime--image', isFolder: false };
    }
    if (mimeType.startsWith('video/')) {
        return { label: 'Video', typeClass: 'mime--video', isFolder: false };
    }
    if (mimeType.startsWith('audio/')) {
        return { label: 'Audio', typeClass: 'mime--audio', isFolder: false };
    }
    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
        return { label: 'Text Note', typeClass: 'mime--text', isFolder: false };
    }
    return { label: 'File', typeClass: 'mime--generic', isFolder: false };
}

/**
 * Lists files and folders from Google Drive API v3.
 */
export async function listDriveFiles(options: {
    query?: string;
    folderId?: string;
    typeFilter?: string;
    pageToken?: string;
    pageSize?: number;
} = {}): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    const token = await getAccessToken();
    if (!token) {
        throw new Error('Authentication required: Please sign in with Google to access Google Drive.');
    }

    const conditions: string[] = ['trashed = false'];

    if (options.folderId) {
        conditions.push(`'${options.folderId}' in parents`);
    }

    if (options.query && options.query.trim()) {
        const escaped = options.query.trim().replace(/'/g, "\\'");
        conditions.push(`(name contains '${escaped}' or fullText contains '${escaped}')`);
    }

    if (options.typeFilter && options.typeFilter !== 'all') {
        switch (options.typeFilter) {
            case 'folders':
                conditions.push("mimeType = 'application/vnd.google-apps.folder'");
                break;
            case 'docs':
                conditions.push("(mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'text/markdown')");
                break;
            case 'sheets':
                conditions.push("mimeType = 'application/vnd.google-apps.spreadsheet'");
                break;
            case 'slides':
                conditions.push("mimeType = 'application/vnd.google-apps.presentation'");
                break;
            case 'pdf':
                conditions.push("mimeType = 'application/pdf'");
                break;
            case 'images':
                conditions.push("mimeType contains 'image/'");
                break;
            case 'videos':
                conditions.push("mimeType contains 'video/'");
                break;
        }
    }

    const q = conditions.join(' and ');
    const params = new URLSearchParams({
        pageSize: String(options.pageSize || 50),
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,webContentLink,iconLink,thumbnailLink,owners,parents,shared)',
        orderBy: 'folder,modifiedTime desc',
        q: q
    });

    if (options.pageToken) {
        params.append('pageToken', options.pageToken);
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const message = errJson?.error?.message || `Google Drive API error: ${response.statusText}`;
        throw new Error(message);
    }

    const data = await response.json();
    return {
        files: data.files || [],
        nextPageToken: data.nextPageToken
    };
}

/**
 * Fetches Google Drive account and storage quota information.
 */
export async function getDriveAbout(): Promise<DriveAbout> {
    const token = await getAccessToken();
    if (!token) {
        throw new Error('Authentication required.');
    }

    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Drive information: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Creates a new folder in Google Drive.
 */
export async function createDriveFolder(name: string, parentFolderId?: string): Promise<DriveFile> {
    const token = await getAccessToken();
    if (!token) {
        throw new Error('Authentication required: Please sign in with Google to create folders.');
    }

    const metadata: any = {
        name,
        mimeType: 'application/vnd.google-apps.folder'
    };

    if (parentFolderId && parentFolderId !== 'root') {
        metadata.parents = [parentFolderId];
    }

    const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,webViewLink', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || 'Failed to create folder in Google Drive');
    }

    return await response.json();
}

/**
 * Uploads a text or markdown intelligence document to Google Drive.
 */
export async function uploadReportToDrive(
    title: string,
    content: string,
    parentFolderId?: string,
    mimeType: string = 'text/plain'
): Promise<DriveFile> {
    const token = await getAccessToken();
    if (!token) {
        throw new Error('Authentication required: Please sign in with Google to save to Drive.');
    }

    const metadata: any = {
        name: title,
        mimeType: mimeType
    };

    if (parentFolderId && parentFolderId !== 'root') {
        metadata.parents = [parentFolderId];
    }

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n` +
        content +
        closeDelimiter;

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary="${boundary}"`
        },
        body: multipartRequestBody
    });

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || 'Failed to upload report to Google Drive');
    }

    return await response.json();
}

/**
 * Uploads a binary file (Image, PDF, Document) to Google Drive.
 */
export async function uploadFileToDrive(
    file: File,
    parentFolderId?: string
): Promise<DriveFile> {
    const token = await getAccessToken();
    if (!token) {
        throw new Error('Authentication required: Please sign in with Google to upload files.');
    }

    const metadata: any = {
        name: file.name,
        mimeType: file.type || 'application/octet-stream'
    };

    if (parentFolderId && parentFolderId !== 'root') {
        metadata.parents = [parentFolderId];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: form
    });

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || 'Failed to upload file to Google Drive');
    }

    return await response.json();
}

/**
 * Deletes a file or folder from Google Drive.
 * WARNING: Calling code MUST present a confirmation dialog to the user before calling this.
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
    const token = await getAccessToken();
    if (!token) {
        throw new Error('Authentication required.');
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok && response.status !== 204) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || 'Failed to delete file from Google Drive');
    }
}

/**
 * Reads text content of a Google Drive file or Google Doc.
 */
export async function fetchDriveFileContent(fileId: string, mimeType: string): Promise<string> {
    const token = await getAccessToken();
    if (!token) {
        throw new Error('Authentication required.');
    }

    let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    if (mimeType === 'application/vnd.google-apps.document') {
        url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    }

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to read file content: ${response.statusText}`);
    }

    return await response.text();
}
