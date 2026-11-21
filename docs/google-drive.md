# Google Drive document library

The existing source folder is **12 Legal and Regulatory / Data Protection and Compliance**:
https://drive.google.com/drive/folders/1GGe9L5sDDZ88H5LzT9qLtpM7vRzqEaPU

The four original country/Q&A reports and the Requirements Overview spreadsheet are in this folder. The `data/provenance.json` spreadsheet ID matches the live spreadsheet. Source research is under `Data Privacy Research / Sources / Research_2026-10-10`; the competitor archive is under `Data Privacy Research / Competitors Positioning / Website privacy archive - 2026-10-10`. Imported document paths in `data/content.json` are relative to this source folder. The separate “Gradias Legal Navigator App” folder was empty when inspected; it is not the source folder.

## Runtime setup

Create or select an organization-managed Google Cloud OAuth web application with the Drive API enabled. Configure its consent screen for the intended Workspace audience. Its scope must include `openid`, `email` and `https://www.googleapis.com/auth/drive` so it can discover files added outside the app, including existing descendants, and upload files as the signed-in user. `drive.file` alone cannot discover all existing and externally added files. External OAuth applications may require Google's verification; an internal Workspace application is appropriate when access is restricted to that organization.

Register this exact authorized redirect URI:

```
https://gradias-legal-navigator-production.up.railway.app/api/auth/google/callback
```

Set these server-side Railway variables:

- `APP_URL`: `https://gradias-legal-navigator-production.up.railway.app`
- `GOOGLE_CLIENT_ID`: the OAuth web client ID.
- `GOOGLE_CLIENT_SECRET`: the client secret.
- `GOOGLE_SESSION_SECRET`: a cryptographically random secret of at least 32 characters; use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` locally. Keep it in Railway secrets, never in Git.
- Optional `GOOGLE_DRIVE_FOLDER_ID` and `GOOGLE_DRIVE_FOLDER_PATH` override the verified defaults. Set both together when changing the root.

For local testing, register `http://127.0.0.1:3000/api/auth/google/callback` on a development OAuth client and use the corresponding `APP_URL`. An unconfigured installation shows the real folder path and link, but cannot pretend that synchronization or sign-in is active.

## Authorization and synchronization

Users sign in with Google and consent to Drive access. Tokens stay in an authenticated, encrypted HttpOnly cookie, never in browser JavaScript or localStorage. Production cookies use Secure and SameSite=Lax. OAuth uses a short-lived state cookie and PKCE. Sessions last up to seven days and renew Google access tokens when possible. Logging out removes the cookie; revocation can also be performed in the Google account's app permissions.

Google's live folder permissions are the authority. A user without access cannot list documents. A reader can browse but cannot upload. The server checks `canAddChildren` immediately before every upload, uses the signed-in user's credentials, and fixes the parent to the configured folder. Upload requests require the app origin, accept one document up to 20 MB, and are rate limited. No anonymous service-account write access is exposed.

The Documents view lists the configured folder recursively, including shared-drive descendants. It refreshes every 30 seconds while visible, on focus, after uploads, and manually. Lists are cached per credential for at most 25 seconds. Every list request rechecks root access. Deletions, renamed files and files added through Drive appear at the next sync; files are identified by ID, not name. Folder shortcuts are not traversed outside the root. Partial listings are explicitly marked. Google errors preserve the last view with an error rather than reporting a successful empty sync; permission denial clears private results.

“Drive-Explorer öffnen” opens the Drive folder in a new browser tab. A website cannot reliably launch a local Windows Explorer folder without a separately installed protocol handler or a user-selected local directory. Users of Drive for desktop can navigate to the same path in their mounted drive.

## Research and existing downloads

The 59 research files and 62 competitor archive files included in the repository remain the reproducible 10 October 2026 research snapshot. Their existing URLs, checksums, source citations and public access remain valid. The Drive catalog follows live files under the original source folder and exposes them only to the authorized Google user. Newly added files are cataloged automatically; they do not automatically rewrite the reviewed legal matrix, competitor conclusions or assistant evidence index. To ask about a new file, attach it to a chat (supported chat formats) or run the documented reviewed content-import workflow. This avoids treating an arbitrary uploaded document as a verified legal finding.

## Validation

Run `npm test`, `npm run typecheck`, `npm run build:railway` and `npm run test:api` against the local server. The document-feature tests mock Google HTTP calls and cover recursive paging, additions/deletions, permission revocation, reader upload denial, authenticated uploads, OAuth state/PKCE, cookie integrity and export safety.

Before release, verify a real Google sign-in, a reader account, an editor upload, and an externally added document appearing within 30 seconds. These live checks require the configured OAuth client and actual Google consent; mocked tests do not establish that the deployment is connected.

Google references: [web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [shared-drive support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives), [file uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
