// Existing source folder, verified against the imported research on 21 Nov 2026.
export const SOURCE_FOLDER_ID='1GGe9L5sDDZ88H5LzT9qLtpM7vRzqEaPU';
export const SOURCE_FOLDER_PATH='12 Legal and Regulatory / Data Protection and Compliance';
export const DRIVE_POLL_MS=30_000;
export function driveFolder(){
 const id=process.env.GOOGLE_DRIVE_FOLDER_ID||SOURCE_FOLDER_ID;
 if(!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('Invalid Google Drive folder configuration');
 return {id,path:process.env.GOOGLE_DRIVE_FOLDER_PATH||(id===SOURCE_FOLDER_ID?SOURCE_FOLDER_PATH:'Google Drive / Documents'),url:`https://drive.google.com/drive/folders/${id}`};
}
export function googleConfigured(){return Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.GOOGLE_SESSION_SECRET&&process.env.GOOGLE_SESSION_SECRET.length>=32&&process.env.APP_URL);}
