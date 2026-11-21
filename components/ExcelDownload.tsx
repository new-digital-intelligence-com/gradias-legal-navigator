'use client';
import {useState} from 'react';
import {Download} from 'lucide-react';
import type {WorkbookTable} from '@/lib/xlsx-export';
import {downloadBlob} from './ChatFiles';

export function ExcelDownload({table,filename,label='Tabelle herunterladen (Excel)'}:{table:WorkbookTable;filename:string;label?:string}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function download(){
    setBusy(true);setError('');
    try{
      const {workbookXLSX,XLSX_MIME}=await import('@/lib/xlsx-export');
      downloadBlob(new Blob([await workbookXLSX(table)],{type:XLSX_MIME}),filename+'.xlsx');
    }catch{setError('Excel-Download fehlgeschlagen. Bitte erneut versuchen.');}
    finally{setBusy(false);}
  }
  return <><button type="button" className="button icon-label" disabled={busy} onClick={()=>void download()}><Download size={15}/><span>{busy?'Excel wird erstellt …':label}</span></button>{error&&<span role="alert">{error}</span>}</>;
}
