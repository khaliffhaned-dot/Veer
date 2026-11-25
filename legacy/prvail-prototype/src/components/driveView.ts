import { 
    googleSignIn, 
    logout, 
    getCurrentUser 
} from '../firebase';
import { 
    listDriveFiles, 
    createDriveFolder, 
    uploadFileToDrive, 
    uploadReportToDrive, 
    deleteDriveFile, 
    fetchDriveFileContent, 
    getDriveAbout, 
    formatBytes, 
    getMimeTypeInfo, 
    DriveFile, 
    DriveQuota 
} from '../services/driveService';

export interface DriveState {
    isAuthenticated: boolean;
    user: any;
    token: string | null;
    files: DriveFile[];
    currentFolderId: string;
    folderBreadcrumbs: Array<{ id: string; name: string }>;
    searchQuery: string;
    typeFilter: string;
    isLoading: boolean;
    quota: DriveQuota | null;
    pendingDeleteFile: DriveFile | null;
    pendingExportPayload: { title: string; content: string } | null;
}

export const driveState: DriveState = {
    isAuthenticated: false,
    user: null,
    token: null,
    files: [],
    currentFolderId: 'root',
    folderBreadcrumbs: [{ id: 'root', name: 'Google Drive' }],
    searchQuery: '',
    typeFilter: 'all',
    isLoading: false,
    quota: null,
    pendingDeleteFile: null,
    pendingExportPayload: null
};

// Global showToast helper reference
let showToastFn: (message: string, type?: 'success' | 'error' | 'info') => void = (msg) => console.log(msg);
let refreshActiveViewFn: () => void = () => {};

export function initDriveComponent(
    toastHandler: (message: string, type?: 'success' | 'error' | 'info') => void,
    refreshHandler: () => void
) {
    showToastFn = toastHandler;
    refreshActiveViewFn = refreshHandler;
    setupDriveModals();
}

/**
 * Updates the authentication header element in the main UI.
 */
export function renderHeaderAuthBadgeHtml(): string {
    if (!driveState.isAuthenticated || !driveState.user) {
        return `
            <div id="drive-header-auth-wrapper">
                <button class="gsi-material-button" id="header-google-signin-btn" type="button" title="Connect Google Drive">
                    <div class="gsi-material-button-content-wrapper">
                        <div class="gsi-material-button-icon">
                            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display: block;">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                                <path fill="none" d="M0 0h48v48H0z"></path>
                            </svg>
                        </div>
                        <span class="gsi-material-button-contents">Sign in with Google</span>
                    </div>
                </button>
            </div>
        `;
    }

    const user = driveState.user;
    const photoUrl = user.photoURL || 'https://i.pravatar.cc/80';
    const displayName = user.displayName || user.email?.split('@')[0] || 'User';

    return `
        <div class="user-profile-badge" id="drive-user-profile-badge">
            <img class="user-profile-badge__avatar" src="${photoUrl}" alt="${displayName}">
            <div class="user-profile-badge__info">
                <span class="user-profile-badge__name">${displayName}</span>
                <span class="user-profile-badge__email">Google Drive Connected</span>
            </div>
            <button class="user-profile-badge__disconnect" id="header-google-logout-btn" title="Sign out / Disconnect">Sign Out</button>
        </div>
    `;
}

export function attachHeaderAuthListeners() {
    document.getElementById('header-google-signin-btn')?.addEventListener('click', async () => {
        await handleGoogleSignInFlow();
    });

    document.getElementById('header-google-logout-btn')?.addEventListener('click', async () => {
        await handleGoogleLogoutFlow();
    });
}

/**
 * Executes Google Sign In and fetches Drive storage details.
 */
export async function handleGoogleSignInFlow(): Promise<boolean> {
    try {
        showToastFn('Opening Google Sign-In with Drive permissions...', 'info');
        const res = await googleSignIn();
        if (res) {
            driveState.isAuthenticated = true;
            driveState.user = res.user;
            driveState.token = res.accessToken;
            showToastFn(`Connected to Google Drive as ${res.user.displayName || res.user.email}`, 'success');
            await refreshDriveFiles();
            updateHeaderAuthBadge();
            refreshActiveViewFn();
            return true;
        }
    } catch (err: any) {
        console.error('Google Sign In failed:', err);
        showToastFn(err.message || 'Failed to sign in with Google.', 'error');
    }
    return false;
}

export async function handleGoogleLogoutFlow() {
    try {
        await logout();
        driveState.isAuthenticated = false;
        driveState.user = null;
        driveState.token = null;
        driveState.files = [];
        driveState.quota = null;
        driveState.currentFolderId = 'root';
        driveState.folderBreadcrumbs = [{ id: 'root', name: 'Google Drive' }];
        showToastFn('Signed out from Google Drive.', 'info');
        updateHeaderAuthBadge();
        refreshActiveViewFn();
    } catch (err: any) {
        console.error('Logout error:', err);
        showToastFn('Error signing out.', 'error');
    }
}

export function updateHeaderAuthBadge() {
    const authWrapper = document.getElementById('header-auth-container');
    if (authWrapper) {
        authWrapper.innerHTML = renderHeaderAuthBadgeHtml();
        attachHeaderAuthListeners();
    }
}

/**
 * Refreshes files from Google Drive API.
 */
export async function refreshDriveFiles() {
    if (!driveState.isAuthenticated) return;
    driveState.isLoading = true;
    try {
        const [filesResult, aboutResult] = await Promise.allSettled([
            listDriveFiles({
                folderId: driveState.currentFolderId,
                query: driveState.searchQuery,
                typeFilter: driveState.typeFilter
            }),
            getDriveAbout()
        ]);

        if (filesResult.status === 'fulfilled') {
            driveState.files = filesResult.value.files;
        } else {
            console.error('Failed to list drive files:', filesResult.reason);
            showToastFn('Could not load Drive files: ' + filesResult.reason.message, 'error');
        }

        if (aboutResult.status === 'fulfilled' && aboutResult.value.storageQuota) {
            driveState.quota = aboutResult.value.storageQuota;
        }
    } catch (e: any) {
        console.error('Drive refresh error:', e);
    } finally {
        driveState.isLoading = false;
    }
}

/**
 * Renders the Google Drive Explorer View.
 */
export function renderDriveFilesViewHtml(): string {
    if (!driveState.isAuthenticated) {
        return `
            <div class="view-header">
                <h2>Google Drive Workspace</h2>
                <p>Access, organize, and export PR intelligence documents directly with Google Drive.</p>
            </div>

            <div class="card" style="text-align: center; padding: 3rem 1.5rem; max-width: 600px; margin: 2rem auto;">
                <div class="drive-logo-icon" style="width: 56px; height: 56px; margin: 0 auto 1.5rem; font-size: 1.8rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                </div>
                <h3 style="font-size: 1.3rem; margin-bottom: 0.75rem;">Connect Google Drive</h3>
                <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 2rem;">
                    Connect your Google account to seamlessly browse, upload, preview, and sync PR reports, due diligence dossiers, and media statements directly to your Google Drive workspace.
                </p>
                <div style="display: flex; justify-content: center;">
                    <button class="gsi-material-button" id="drive-connect-view-btn" type="button">
                        <div class="gsi-material-button-content-wrapper">
                            <div class="gsi-material-button-icon">
                                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display: block;">
                                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                                    <path fill="none" d="M0 0h48v48H0z"></path>
                                </svg>
                            </div>
                            <span class="gsi-material-button-contents">Sign in with Google</span>
                        </div>
                    </button>
                </div>
            </div>
        `;
    }

    // Quota details
    let quotaHtml = '';
    if (driveState.quota) {
        const usage = driveState.quota.usage ? parseInt(driveState.quota.usage, 10) : 0;
        const limit = driveState.quota.limit ? parseInt(driveState.quota.limit, 10) : 0;
        const pct = limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 0;
        quotaHtml = `
            <div class="drive-quota-bar-container">
                <div class="drive-quota-labels">
                    <span>Storage Quota</span>
                    <span>${formatBytes(usage)} of ${limit > 0 ? formatBytes(limit) : 'Unlimited'} (${pct}%)</span>
                </div>
                <div class="drive-quota-track">
                    <div class="drive-quota-fill" style="width: ${pct}%;"></div>
                </div>
            </div>
        `;
    }

    // Breadcrumb navigation
    const breadcrumbHtml = `
        <div class="drive-breadcrumbs">
            ${driveState.folderBreadcrumbs.map((crumb, idx) => {
                const isLast = idx === driveState.folderBreadcrumbs.length - 1;
                return `
                    <span class="drive-breadcrumb-item ${isLast ? 'active' : ''}" data-folder-id="${crumb.id}">
                        ${idx === 0 ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>' : ''}
                        ${crumb.name}
                    </span>
                    ${!isLast ? '<span class="drive-breadcrumb-sep">/</span>' : ''}
                `;
            }).join('')}
        </div>
    `;

    // Filter pills
    const filters = [
        { id: 'all', label: 'All Files' },
        { id: 'folders', label: 'Folders' },
        { id: 'docs', label: 'Documents' },
        { id: 'sheets', label: 'Spreadsheets' },
        { id: 'slides', label: 'Presentations' },
        { id: 'pdf', label: 'PDFs' },
        { id: 'images', label: 'Images' },
        { id: 'videos', label: 'Videos' }
    ];

    const filtersHtml = `
        <div class="drive-filters">
            ${filters.map(f => `
                <button class="drive-filter-btn ${driveState.typeFilter === f.id ? 'active' : ''}" data-filter="${f.id}" type="button">
                    ${f.label}
                </button>
            `).join('')}
        </div>
    `;

    // Files list
    let contentHtml = '';
    if (driveState.isLoading) {
        contentHtml = `
            <div class="empty-state" style="padding: 3rem;">
                <div class="spinner" style="width: 32px; height: 32px; border: 3px solid var(--border-color); border-top-color: var(--primary); border-radius: 50%; animation: spinner-spin 0.8s linear infinite; margin: 0 auto 1rem;"></div>
                <p>Loading files from Google Drive...</p>
            </div>
        `;
    } else if (driveState.files.length === 0) {
        contentHtml = `
            <div class="empty-state" style="padding: 3rem 1.5rem; text-align: center; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-secondary); margin-bottom: 1rem;"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">No files found in this folder</h4>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Upload documents or create folders to organize your PR intelligence workspace.</p>
                <div style="display: flex; gap: 0.75rem; justify-content: center;">
                    <button id="drive-empty-upload-btn" class="btn btn--primary" type="button">Upload File</button>
                    <button id="drive-empty-newfolder-btn" class="btn btn--secondary" type="button">New Folder</button>
                </div>
            </div>
        `;
    } else {
        contentHtml = `
            <div class="drive-grid">
                ${driveState.files.map(file => {
                    const info = getMimeTypeInfo(file.mimeType);
                    const formattedDate = new Date(file.modifiedTime).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });

                    return `
                        <div class="drive-file-card" data-file-id="${file.id}" data-mime-type="${file.mimeType}" data-name="${escapeHtml(file.name)}">
                            <div>
                                <div class="drive-file-card__top">
                                    <div class="drive-file-icon-box ${info.typeClass}">
                                        ${getFileIconSvg(file.mimeType)}
                                    </div>
                                    <div class="drive-card-actions">
                                        <button class="drive-card-menu-btn" data-file-id="${file.id}" title="File options" type="button">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                        </button>
                                        <div class="drive-card-menu" id="menu-${file.id}">
                                            ${file.webViewLink ? `
                                                <a href="${file.webViewLink}" target="_blank" rel="noopener noreferrer" class="drive-menu-item">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                                    Open in Drive
                                                </a>
                                            ` : ''}
                                            ${!info.isFolder ? `
                                                <button class="drive-menu-item drive-action-import" data-file-id="${file.id}" data-mime-type="${file.mimeType}" data-name="${escapeHtml(file.name)}" type="button">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"></path></svg>
                                                    Import into PRVAIL
                                                </button>
                                            ` : ''}
                                            <button class="drive-menu-item danger drive-action-delete" data-file-id="${file.id}" data-name="${escapeHtml(file.name)}" type="button">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="drive-file-card__name" title="${escapeHtml(file.name)}">
                                    ${escapeHtml(file.name)}
                                </div>
                            </div>
                            <div class="drive-file-card__meta">
                                <span class="drive-badge ${info.typeClass}">${info.label}</span>
                                <span>${info.isFolder ? 'Folder' : (file.size ? formatBytes(file.size) : formattedDate)}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    return `
        <div class="view-header">
            <h2>Google Drive Workspace</h2>
            <p>Direct integration with your Google Drive storage for media dossiers, statements, and intelligence briefs.</p>
        </div>

        <div class="drive-header-card">
            <div class="drive-header-info">
                <div class="drive-logo-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                </div>
                <div class="drive-header-text">
                    <h3>Google Drive File Hub <span class="badge badge--success" style="font-size: 0.75rem; vertical-align: middle;">Live Synced</span></h3>
                    <p>Connected account: <strong>${driveState.user?.email || 'Active'}</strong></p>
                </div>
            </div>
            ${quotaHtml}
        </div>

        <div class="drive-toolbar">
            <div class="drive-toolbar-left">
                <div class="drive-search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" id="drive-search-input" placeholder="Search Drive files..." value="${escapeHtml(driveState.searchQuery)}">
                </div>
            </div>
            <div class="drive-toolbar-actions">
                <button id="drive-refresh-btn" class="btn btn--secondary btn--icon" title="Refresh files" type="button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                </button>
                <button id="drive-new-folder-btn" class="btn btn--secondary" type="button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
                    New Folder
                </button>
                <button id="drive-upload-btn" class="btn btn--primary" type="button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload File
                </button>
            </div>
        </div>

        ${breadcrumbHtml}
        ${filtersHtml}
        ${contentHtml}
    `;
}

/**
 * Attaches event handlers to the Drive Files View.
 */
export function attachDriveFilesViewListeners() {
    if (!driveState.isAuthenticated) {
        document.getElementById('drive-connect-view-btn')?.addEventListener('click', async () => {
            await handleGoogleSignInFlow();
        });
        return;
    }

    // Search
    let searchDebounce: any = null;
    const searchInput = document.getElementById('drive-search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(async () => {
            driveState.searchQuery = searchInput.value;
            await refreshDriveFiles();
            refreshActiveViewFn();
        }, 400);
    });

    // Refresh
    document.getElementById('drive-refresh-btn')?.addEventListener('click', async () => {
        await refreshDriveFiles();
        refreshActiveViewFn();
        showToastFn('Google Drive files updated', 'info');
    });

    // New folder
    document.getElementById('drive-new-folder-btn')?.addEventListener('click', () => {
        openCreateFolderModal();
    });
    document.getElementById('drive-empty-newfolder-btn')?.addEventListener('click', () => {
        openCreateFolderModal();
    });

    // Upload file
    document.getElementById('drive-upload-btn')?.addEventListener('click', () => {
        openUploadFileModal();
    });
    document.getElementById('drive-empty-upload-btn')?.addEventListener('click', () => {
        openUploadFileModal();
    });

    // Filter pills
    document.querySelectorAll('.drive-filter-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const filter = (btn as HTMLElement).dataset.filter || 'all';
            if (driveState.typeFilter !== filter) {
                driveState.typeFilter = filter;
                await refreshDriveFiles();
                refreshActiveViewFn();
            }
        });
    });

    // Breadcrumb navigation
    document.querySelectorAll('.drive-breadcrumb-item').forEach(item => {
        item.addEventListener('click', async () => {
            const folderId = (item as HTMLElement).dataset.folderId;
            if (folderId && folderId !== driveState.currentFolderId) {
                const idx = driveState.folderBreadcrumbs.findIndex(b => b.id === folderId);
                if (idx !== -1) {
                    driveState.folderBreadcrumbs = driveState.folderBreadcrumbs.slice(0, idx + 1);
                }
                driveState.currentFolderId = folderId;
                await refreshDriveFiles();
                refreshActiveViewFn();
            }
        });
    });

    // Folder navigation on card click
    document.querySelectorAll('.drive-file-card').forEach(card => {
        card.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.drive-card-actions')) return; // Ignore if clicked inside action menu

            const mimeType = (card as HTMLElement).dataset.mimeType;
            const fileId = (card as HTMLElement).dataset.fileId;
            const name = (card as HTMLElement).dataset.name || 'Folder';

            if (mimeType === 'application/vnd.google-apps.folder' && fileId) {
                driveState.currentFolderId = fileId;
                driveState.folderBreadcrumbs.push({ id: fileId, name: name });
                await refreshDriveFiles();
                refreshActiveViewFn();
            }
        });
    });

    // 3-dot dropdown menu toggles
    document.querySelectorAll('.drive-card-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileId = (btn as HTMLElement).dataset.fileId;
            const menu = document.getElementById(`menu-${fileId}`);
            
            // Close other open menus
            document.querySelectorAll('.drive-card-menu.open').forEach(m => {
                if (m !== menu) m.classList.remove('open');
            });

            menu?.classList.toggle('open');
        });
    });

    // Close menus on outside click
    document.addEventListener('click', () => {
        document.querySelectorAll('.drive-card-menu.open').forEach(m => m.classList.remove('open'));
    });

    // Delete actions (Mandatory Confirmation Dialog)
    document.querySelectorAll('.drive-action-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileId = (btn as HTMLElement).dataset.fileId;
            const name = (btn as HTMLElement).dataset.name || 'File';
            const file = driveState.files.find(f => f.id === fileId) || { id: fileId!, name, mimeType: '' } as DriveFile;
            openDeleteConfirmModal(file);
        });
    });

    // Import actions
    document.querySelectorAll('.drive-action-import').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const fileId = (btn as HTMLElement).dataset.fileId;
            const mimeType = (btn as HTMLElement).dataset.mimeType || '';
            const name = (btn as HTMLElement).dataset.name || 'Document';
            if (!fileId) return;

            try {
                showToastFn(`Importing "${name}" from Drive...`, 'info');
                const content = await fetchDriveFileContent(fileId, mimeType);
                
                // Show imported content in toast or preview
                const snippet = content.slice(0, 150).replace(/\n/g, ' ');
                showToastFn(`Imported ${name} (${content.length} characters)`, 'success');
                console.log(`Imported Drive Content for ${name}:`, content);
            } catch (err: any) {
                console.error('Import error:', err);
                showToastFn('Could not import file: ' + err.message, 'error');
            }
        });
    });
}

/**
 * Renders the PR Intelligence Vault view (Export and synchronize reports to Google Drive).
 */
export function renderDriveVaultViewHtml(): string {
    if (!driveState.isAuthenticated) {
        return renderDriveFilesViewHtml();
    }

    return `
        <div class="view-header">
            <h2>PR Intelligence Vault</h2>
            <p>Export executive briefings, narrative verification logs, and AI crisis statements straight to Google Drive.</p>
        </div>

        <div class="card" style="margin-bottom: 1.5rem;">
            <div class="card__header">
                <h3>One-Click Intelligence Export to Google Drive</h3>
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.6;">
                Generate customized briefings and save them permanently to your Google Drive workspace. Exported documents are formatted for immediate distribution to executives, legal counsel, and communication teams.
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1.25rem; background-color: var(--surface-light);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.75rem;">
                        <span class="drive-badge mime--doc">Crisis AI</span>
                        <h4 style="font-size: 1rem;">Executive Crisis Response</h4>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
                        Standardized holding statements, key talking points, and stakeholder communication roadmaps.
                    </p>
                    <button class="btn btn--primary btn-vault-export" data-type="crisis" type="button">
                        Save to Drive (.md)
                    </button>
                </div>

                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1.25rem; background-color: var(--surface-light);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.75rem;">
                        <span class="drive-badge mime--sheet">Veritas</span>
                        <h4 style="font-size: 1rem;">Narrative Verification Dossier</h4>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
                        Detailed forensic breakdown of source attribution, misinformation vectors, and media reach.
                    </p>
                    <button class="btn btn--primary btn-vault-export" data-type="narrative" type="button">
                        Save to Drive (.md)
                    </button>
                </div>

                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1.25rem; background-color: var(--surface-light);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.75rem;">
                        <span class="drive-badge mime--slides">Amplify</span>
                        <h4 style="font-size: 1rem;">Strategic Campaign Blueprint</h4>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
                        30-day cross-channel campaign schedule, key message angles, and KOL alignment plan.
                    </p>
                    <button class="btn btn--primary btn-vault-export" data-type="campaign" type="button">
                        Save to Drive (.md)
                    </button>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card__header">
                <h3>Drive Sync Information</h3>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <p style="font-weight: 600; margin-bottom: 4px;">Connected Google Account: <span style="color: var(--primary);">${driveState.user?.email || 'N/A'}</span></p>
                    <p style="font-size: 0.85rem; color: var(--text-secondary);">Target Root Folder: <strong>Google Drive / PRVAIL Intelligence</strong></p>
                </div>
                <button class="btn btn--secondary" id="vault-open-explorer-btn" type="button">
                    Open Drive Explorer
                </button>
            </div>
        </div>
    `;
}

export function attachDriveVaultViewListeners() {
    document.querySelectorAll('.btn-vault-export').forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = (btn as HTMLElement).dataset.type;
            let title = '';
            let content = '';

            const dateStr = new Date().toISOString().split('T')[0];
            if (type === 'crisis') {
                title = `PRVAIL Crisis Response Directive - ${dateStr}.md`;
                content = `# PRVAIL AI Executive Crisis Statement & Directive\nDate: ${new Date().toLocaleString()}\n\n## 1. Executive Summary\n- Immediate holding statement issued.\n- Spokesperson briefing scheduled.\n\n## 2. Key Talking Points\n- Priority safety and transparent disclosure.\n- 24/7 Monitoring active across digital and mainstream channels.\n\nGenerated via PRVAIL Enterprise Intelligence.`;
            } else if (type === 'narrative') {
                title = `PRVAIL Veritas Integrity Dossier - ${dateStr}.md`;
                content = `# PRVAIL Veritas Forensic Integrity Dossier\nDate: ${new Date().toLocaleString()}\n\n## Narrative Authenticity: 88% VERIFIED\n- Propagation velocity: Moderate\n- Source: Multi-channel syndicate\n\nGenerated via PRVAIL Enterprise Intelligence.`;
            } else {
                title = `PRVAIL Strategic Campaign Blueprint - ${dateStr}.md`;
                content = `# PRVAIL Strategic Campaign Blueprint\nDate: ${new Date().toLocaleString()}\n\n## Campaign Overview\n- Objective: Brand Narrative Elevation\n- Channels: LinkedIn, TikTok, Bernama, The Star\n\nGenerated via PRVAIL Enterprise Intelligence.`;
            }

            openSaveToDriveModal(title, content);
        });
    });

    document.getElementById('vault-open-explorer-btn')?.addEventListener('click', () => {
        const link = document.querySelector('.sub-nav-item[data-view="drive-files-view"]') as HTMLElement;
        link?.click();
    });
}

/**
 * Modal helpers and event attachments.
 */
function setupDriveModals() {
    // 1. Create Folder Modal
    const folderOverlay = document.getElementById('drive-create-folder-modal-overlay');
    const folderCloseBtn = document.getElementById('drive-create-folder-modal-close');
    const folderCancelBtn = document.getElementById('drive-create-folder-cancel-btn');
    const folderConfirmBtn = document.getElementById('drive-create-folder-confirm-btn');
    const folderInput = document.getElementById('drive-new-folder-name-input') as HTMLInputElement;

    const closeFolderModal = () => {
        folderOverlay?.classList.remove('visible');
        if (folderInput) folderInput.value = '';
    };

    folderCloseBtn?.addEventListener('click', closeFolderModal);
    folderCancelBtn?.addEventListener('click', closeFolderModal);
    folderConfirmBtn?.addEventListener('click', async () => {
        const name = folderInput?.value.trim();
        if (!name) {
            showToastFn('Please enter a folder name.', 'error');
            return;
        }
        try {
            showToastFn(`Creating folder "${name}" in Google Drive...`, 'info');
            await createDriveFolder(name, driveState.currentFolderId);
            showToastFn(`Folder "${name}" created successfully!`, 'success');
            closeFolderModal();
            await refreshDriveFiles();
            refreshActiveViewFn();
        } catch (err: any) {
            console.error('Create folder error:', err);
            showToastFn(err.message || 'Failed to create folder', 'error');
        }
    });

    // 2. Upload File Modal
    const uploadOverlay = document.getElementById('drive-upload-modal-overlay');
    const uploadCloseBtn = document.getElementById('drive-upload-modal-close');
    const uploadCancelBtn = document.getElementById('drive-upload-cancel-btn');
    const uploadConfirmBtn = document.getElementById('drive-upload-confirm-btn');
    const fileInput = document.getElementById('drive-file-input') as HTMLInputElement;

    const closeUploadModal = () => {
        uploadOverlay?.classList.remove('visible');
        if (fileInput) fileInput.value = '';
    };

    uploadCloseBtn?.addEventListener('click', closeUploadModal);
    uploadCancelBtn?.addEventListener('click', closeUploadModal);
    uploadConfirmBtn?.addEventListener('click', async () => {
        if (!fileInput?.files || fileInput.files.length === 0) {
            showToastFn('Please select a file to upload.', 'error');
            return;
        }
        const file = fileInput.files[0];
        try {
            showToastFn(`Uploading "${file.name}" to Google Drive...`, 'info');
            await uploadFileToDrive(file, driveState.currentFolderId);
            showToastFn(`"${file.name}" uploaded successfully to Google Drive!`, 'success');
            closeUploadModal();
            await refreshDriveFiles();
            refreshActiveViewFn();
        } catch (err: any) {
            console.error('Upload error:', err);
            showToastFn(err.message || 'Failed to upload file', 'error');
        }
    });

    // 3. Save Report Modal
    const saveOverlay = document.getElementById('drive-save-report-modal-overlay');
    const saveCloseBtn = document.getElementById('drive-save-report-modal-close');
    const saveCancelBtn = document.getElementById('drive-save-report-cancel-btn');
    const saveConfirmBtn = document.getElementById('drive-save-report-confirm-btn');
    const reportTitleInput = document.getElementById('drive-report-title-input') as HTMLInputElement;
    const reportFormatSelect = document.getElementById('drive-report-format-select') as HTMLSelectElement;

    const closeSaveModal = () => {
        saveOverlay?.classList.remove('visible');
        driveState.pendingExportPayload = null;
    };

    saveCloseBtn?.addEventListener('click', closeSaveModal);
    saveCancelBtn?.addEventListener('click', closeSaveModal);
    saveConfirmBtn?.addEventListener('click', async () => {
        const title = reportTitleInput?.value.trim();
        const mimeType = reportFormatSelect?.value || 'text/plain';
        const payload = driveState.pendingExportPayload;

        if (!title) {
            showToastFn('Please enter a document title.', 'error');
            return;
        }
        if (!payload) {
            showToastFn('No content to export.', 'error');
            return;
        }

        try {
            showToastFn(`Saving "${title}" to Google Drive...`, 'info');
            await uploadReportToDrive(title, payload.content, driveState.currentFolderId, mimeType);
            showToastFn(`Report "${title}" saved to Google Drive!`, 'success');
            closeSaveModal();
            await refreshDriveFiles();
            refreshActiveViewFn();
        } catch (err: any) {
            console.error('Save report error:', err);
            showToastFn(err.message || 'Failed to save report to Google Drive', 'error');
        }
    });

    // 4. Delete Confirmation Modal (Mandatory pattern for destructive operations)
    const deleteOverlay = document.getElementById('drive-delete-modal-overlay');
    const deleteCancelBtn = document.getElementById('drive-delete-cancel-btn');
    const deleteConfirmBtn = document.getElementById('drive-delete-confirm-btn');
    const deleteMessage = document.getElementById('drive-delete-modal-message');

    const closeDeleteModal = () => {
        deleteOverlay?.classList.remove('visible');
        driveState.pendingDeleteFile = null;
    };

    deleteCancelBtn?.addEventListener('click', closeDeleteModal);
    deleteConfirmBtn?.addEventListener('click', async () => {
        const file = driveState.pendingDeleteFile;
        if (!file) return;

        try {
            showToastFn(`Deleting "${file.name}" from Google Drive...`, 'info');
            await deleteDriveFile(file.id);
            showToastFn(`"${file.name}" was permanently removed from Google Drive.`, 'success');
            closeDeleteModal();
            await refreshDriveFiles();
            refreshActiveViewFn();
        } catch (err: any) {
            console.error('Delete error:', err);
            showToastFn(err.message || 'Failed to delete file from Google Drive', 'error');
        }
    });
}

export function openCreateFolderModal() {
    const overlay = document.getElementById('drive-create-folder-modal-overlay');
    overlay?.classList.add('visible');
    const input = document.getElementById('drive-new-folder-name-input') as HTMLInputElement;
    input?.focus();
}

export function openUploadFileModal() {
    const overlay = document.getElementById('drive-upload-modal-overlay');
    overlay?.classList.add('visible');
}

export function openSaveToDriveModal(defaultTitle: string, content: string) {
    if (!driveState.isAuthenticated) {
        showToastFn('Please connect your Google Drive account first.', 'info');
        handleGoogleSignInFlow().then(success => {
            if (success) openSaveToDriveModal(defaultTitle, content);
        });
        return;
    }

    driveState.pendingExportPayload = { title: defaultTitle, content };
    const overlay = document.getElementById('drive-save-report-modal-overlay');
    const titleInput = document.getElementById('drive-report-title-input') as HTMLInputElement;
    if (titleInput) {
        titleInput.value = defaultTitle;
    }
    overlay?.classList.add('visible');
}

export function openDeleteConfirmModal(file: DriveFile) {
    driveState.pendingDeleteFile = file;
    const overlay = document.getElementById('drive-delete-modal-overlay');
    const message = document.getElementById('drive-delete-modal-message');
    if (message) {
        message.innerHTML = `Are you sure you want to permanently delete <strong>${escapeHtml(file.name)}</strong> from Google Drive? This action cannot be undone.`;
    }
    overlay?.classList.add('visible');
}

/**
 * Returns an appropriate SVG icon for given file MIME type.
 */
function getFileIconSvg(mimeType: string): string {
    if (mimeType === 'application/vnd.google-apps.folder') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`;
    }
    if (mimeType.includes('spreadsheet') || mimeType === 'application/vnd.google-apps.spreadsheet') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18V3H3zm9 16H5v-4h7v4zm0-6H5V9h7v4zm0-6H5V5h7v2zm7 12h-5v-4h5v4zm0-6h-5V9h5v4zm0-6h-5V5h5v2z"/></svg>`;
    }
    if (mimeType.includes('presentation') || mimeType === 'application/vnd.google-apps.presentation') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
    }
    if (mimeType === 'application/pdf') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
    }
    if (mimeType.startsWith('image/')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    }
    if (mimeType.startsWith('video/')) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
