import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const outputDir = new URL('.', import.meta.url);
const outputPath = new URL('plantilla_asignacion_opm.xlsx', outputDir);
const previewPath = new URL('plantilla_asignacion_opm.png', outputDir);
const phpCode = "require 'C:/xampp/htdocs/evadesopm/backend/lib/xlsx.php'; echo xlsx_build_assignments_template();";

const workbookBytes = execFileSync('C:/xampp/php/php.exe', ['-r', phpCode]);
await fs.writeFile(outputPath, workbookBytes);

const input = await FileBlob.load(fileURLToPath(outputPath));
const workbook = await SpreadsheetFile.importXlsx(input);
const inspection = await workbook.inspect({
  kind: 'workbook,sheet,table',
  range: 'ASIGNACION!A1:G2',
  include: 'values,formulas',
  tableMaxRows: 2,
  tableMaxCols: 7,
  maxChars: 3000,
});
const preview = await workbook.render({
  sheetName: 'ASIGNACION',
  range: 'A1:G2',
  scale: 2,
  format: 'png',
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
console.log(inspection.ndjson);
