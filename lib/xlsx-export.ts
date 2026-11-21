import ExcelJS from 'exceljs';
import type {ExportCitation} from './answer-tables';

export type WorkbookTable = {
  title:string;
  columns:string[];
  rows:string[][];
  note:string;
  sources?:ExportCitation[];
};
export const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function workbookXLSX(table:WorkbookTable):Promise<ArrayBuffer> {
  const workbook=new ExcelJS.Workbook();
  workbook.creator='Gradias Legal Navigator';
  workbook.title=table.title;
  function addSheet(name:string,title:string,columns:string[],rows:string[][],note:string){
    const sheet=workbook.addWorksheet(name,{views:[{state:'frozen',xSplit:1,ySplit:4}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:4'}});
    sheet.columns=columns.map((header,i)=>({width:Math.min(65,Math.max(22,header.length+2,...rows.map(row=>Math.min(65,(row[i]||'').length))))}));
    sheet.mergeCells(1,1,1,columns.length);sheet.getCell(1,1).value=title;
    sheet.getCell(1,1).font={name:'Calibri',size:16,bold:true,color:{argb:'FF163047'}};sheet.getRow(1).height=30;
    sheet.mergeCells(2,1,2,columns.length);sheet.getCell(2,1).value=note;
    sheet.getCell(2,1).alignment={wrapText:true,vertical:'top'};sheet.getRow(2).height=60;
    sheet.getRow(4).values=columns;sheet.getRow(4).height=42;
    sheet.getRow(4).eachCell(cell=>{cell.font={name:'Calibri',bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF315D7E'}};cell.alignment={wrapText:true,vertical:'middle'};});
    rows.forEach((values,index)=>{
      const row=sheet.getRow(index+5);row.values=values;
      row.height=Math.min(409,Math.max(30,...values.map((value,i)=>value.split('\n').reduce((lines,line)=>lines+Math.max(1,Math.ceil(line.length/((sheet.getColumn(i+1).width||22)-2))),0)*15+8)));
      row.eachCell(cell=>{
        // Assign strings, never formula objects: even =, +, - and @ remain literal text.
        cell.font={name:'Calibri',size:11,color:{argb:'FF163047'}};
        cell.alignment={wrapText:true,vertical:'top'};
        if(index%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F5FA'}};
        if(typeof cell.value==='string'&&/^https?:\/\/\S+$/i.test(cell.value)){
          cell.value={text:cell.value,hyperlink:cell.value};cell.font={name:'Calibri',size:11,color:{argb:'FF1568AA'},underline:true};
        }
      });
    });
    sheet.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,rows.length+4),column:columns.length}};
  }
  addSheet('Tabelle',table.title,table.columns,table.rows,table.note);
  if(table.sources?.length)addSheet('Quellen','Quellennachweise',['Quellen-ID','Titel','URL'],table.sources.flatMap(source=>(source.urls.length?source.urls:['']).map(url=>[source.id,source.title,url])),table.note);
  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer;
}
