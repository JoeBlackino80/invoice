// XLSX export generátor
import ExcelJS from "exceljs"

interface XLSXOptions {
  columnWidths?: number[]
  headerStyle?: boolean
  sheetName?: string
}

/**
 * Generuje XLSX buffer z dát
 */
export async function generateXLSX(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  options: XLSXOptions = {}
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "ERP Systém"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(options.sheetName || title.substring(0, 31))

  // Hlavička
  const titleRow = sheet.addRow([title])
  titleRow.font = { bold: true, size: 14 }
  sheet.addRow([]) // prázdny riadok

  // Stĺpcové hlavičky
  const headerRow = sheet.addRow(headers)
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    }
    cell.border = {
      bottom: { style: "thin" },
    }
    cell.alignment = { horizontal: "center" }
  })

  // Dáta
  for (const row of rows) {
    const dataRow = sheet.addRow(row)
    dataRow.eachCell((cell, colNumber) => {
      const value = row[colNumber - 1]
      if (typeof value === "number") {
        cell.numFmt = "#,##0.00"
        cell.alignment = { horizontal: "right" }
      }
    })
  }

  // Šírky stĺpcov
  if (options.columnWidths) {
    options.columnWidths.forEach((width, i) => {
      const col = sheet.getColumn(i + 1)
      col.width = width
    })
  } else {
    // Auto-width
    sheet.columns.forEach((column) => {
      let maxLength = 10
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const length = cell.value ? cell.value.toString().length : 0
        maxLength = Math.max(maxLength, length)
      })
      column.width = Math.min(maxLength + 2, 40)
    })
  }

  // Auto-filter
  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3, column: headers.length },
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
