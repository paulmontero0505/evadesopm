import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const outputDir = new URL('.', import.meta.url);
const outputPath = new URL('plantilla_colaboradores.xlsx', outputDir);
const previewPath = new URL('plantilla_colaboradores.png', outputDir);
const importTestPath = new URL('import-test.xlsx', outputDir);
const phpCode = "require 'C:/xampp/htdocs/evadesopm/backend/lib/xlsx.php'; echo xlsx_build_opms_template();";

const workbookBytes = execFileSync('C:/xampp/php/php.exe', ['-r', phpCode]);
await fs.writeFile(outputPath, workbookBytes);
const input = await FileBlob.load(fileURLToPath(outputPath));
const workbook = await SpreadsheetFile.importXlsx(input);
const inspection = await workbook.inspect({
  kind: 'workbook,sheet,table',
  range: 'COLABORADORES!A1:I2',
  include: 'values,formulas',
  tableMaxRows: 2,
  tableMaxCols: 9,
  maxChars: 3000,
});
const preview = await workbook.render({ sheetName: 'COLABORADORES', range: 'A1:I2', scale: 2, format: 'png' });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
console.log(inspection.ndjson);

const sheet = workbook.worksheets.getItem('COLABORADORES');
sheet.getRange('A2:I2').values = [[
  '0000116', 'OLIVOS TOLENTINO CESAR JOSE', 'OPERARIO DE PUERTO MULTIPROPOSITO',
  '2025-01-16', '49863339', '1995-11-23', '998227819', 'olivos@example.com', 'SIN ASIGNAR',
]];
const importTest = await SpreadsheetFile.exportXlsx(workbook);
await importTest.save(fileURLToPath(importTestPath));
const parsed = execFileSync('C:/xampp/php/php.exe', ['-r', "require 'C:/xampp/htdocs/evadesopm/backend/lib/xlsx.php'; echo json_encode(xlsx_read_opms('" + fileURLToPath(importTestPath).replace(/\\/g, '/') + "'));"], { encoding: 'utf8' });
console.log(parsed);
