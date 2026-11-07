export type FileInput={name:string;data:string};
export type ValidFile=FileInput&{mime:string;text?:string};
export const MAX_FILE_BYTES:number;
export const MAX_TOTAL_BYTES:number;
export const FILE_INSTRUCTIONS:string;
export function validateFiles(files:unknown):ValidFile[];
export function modelMessages(messages:{role:string;content:string;attachments?:unknown}[]):{role:string;content:unknown}[];
