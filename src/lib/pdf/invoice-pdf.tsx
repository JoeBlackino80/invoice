import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  col: {
    width: "48%",
  },
  label: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 1,
  },
  value: {
    fontSize: 9,
    marginBottom: 4,
  },
  boldValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  colDesc: { width: "35%" },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "8%", textAlign: "center" },
  colPrice: { width: "15%", textAlign: "right" },
  colVat: { width: "8%", textAlign: "right" },
  colBase: { width: "12%", textAlign: "right" },
  colTotal: { width: "12%", textAlign: "right" },
  headerText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
  },
  totals: {
    marginTop: 15,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 3,
    width: 250,
  },
  totalLabel: {
    width: 150,
    textAlign: "right",
    paddingRight: 10,
    fontSize: 9,
  },
  totalValue: {
    width: 100,
    textAlign: "right",
    fontSize: 9,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 250,
    borderTopWidth: 2,
    borderTopColor: "#1e40af",
    paddingTop: 5,
    marginTop: 5,
  },
  grandTotalLabel: {
    width: 150,
    textAlign: "right",
    paddingRight: 10,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  grandTotalValue: {
    width: 100,
    textAlign: "right",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  qrContainer: {
    alignItems: "center",
  },
  qrLabel: {
    fontSize: 7,
    color: "#6b7280",
    marginTop: 3,
  },
  notes: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginBottom: 3,
  },
  notesText: {
    fontSize: 8,
    color: "#6b7280",
  },
  bankInfo: {
    marginTop: 15,
  },
})

function formatMoney(amount: number, currency = "EUR"): string {
  return `${amount.toFixed(2)} ${currency}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("sk-SK")
}

interface InvoicePDFProps {
  invoice: any
  items: any[]
  qrDataUrl?: string
}

export function InvoicePDF({ invoice, items, qrDataUrl }: InvoicePDFProps) {
  const typeLabels: Record<string, string> = {
    vydana: "Faktúra",
    prijata: "Prijatá faktúra",
    zalohova: "Zálohová faktúra",
    dobropis: "Dobropis",
    proforma: "Proforma faktúra",
  }

  // Grupovanie DPH podľa sadzieb
  const vatGroups: Record<number, { base: number; vat: number }> = {}
  items.forEach((item) => {
    const rate = item.vat_rate
    if (!vatGroups[rate]) vatGroups[rate] = { base: 0, vat: 0 }
    vatGroups[rate].base += item.subtotal
    vatGroups[rate].vat += item.vat_amount
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>
              {typeLabels[invoice.type] || "Faktúra"} č. {invoice.number}
            </Text>
            {invoice.variable_symbol && (
              <Text style={styles.subtitle}>VS: {invoice.variable_symbol}</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.label}>Dátum vystavenia</Text>
            <Text style={styles.boldValue}>{formatDate(invoice.issue_date)}</Text>
            <Text style={styles.label}>Dátum dodania</Text>
            <Text style={styles.value}>{formatDate(invoice.delivery_date)}</Text>
            <Text style={styles.label}>Dátum splatnosti</Text>
            <Text style={styles.boldValue}>{formatDate(invoice.due_date)}</Text>
          </View>
        </View>

        {/* Dodávateľ / Odberateľ */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Dodávateľ</Text>
            <Text style={styles.boldValue}>{invoice.supplier_name}</Text>
            {invoice.supplier_street && <Text style={styles.value}>{invoice.supplier_street}</Text>}
            {(invoice.supplier_zip || invoice.supplier_city) && (
              <Text style={styles.value}>
                {invoice.supplier_zip} {invoice.supplier_city}
              </Text>
            )}
            {invoice.supplier_ico && (
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                <Text style={styles.label}>IČO: </Text>
                <Text style={styles.value}>{invoice.supplier_ico}</Text>
              </View>
            )}
            {invoice.supplier_dic && (
              <View style={{ flexDirection: "row" }}>
                <Text style={styles.label}>DIČ: </Text>
                <Text style={styles.value}>{invoice.supplier_dic}</Text>
              </View>
            )}
            {invoice.supplier_ic_dph && (
              <View style={{ flexDirection: "row" }}>
                <Text style={styles.label}>IČ DPH: </Text>
                <Text style={styles.value}>{invoice.supplier_ic_dph}</Text>
              </View>
            )}
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Odberateľ</Text>
            <Text style={styles.boldValue}>{invoice.customer_name}</Text>
            {invoice.customer_street && <Text style={styles.value}>{invoice.customer_street}</Text>}
            {(invoice.customer_zip || invoice.customer_city) && (
              <Text style={styles.value}>
                {invoice.customer_zip} {invoice.customer_city}
              </Text>
            )}
            {invoice.customer_ico && (
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                <Text style={styles.label}>IČO: </Text>
                <Text style={styles.value}>{invoice.customer_ico}</Text>
              </View>
            )}
            {invoice.customer_dic && (
              <View style={{ flexDirection: "row" }}>
                <Text style={styles.label}>DIČ: </Text>
                <Text style={styles.value}>{invoice.customer_dic}</Text>
              </View>
            )}
            {invoice.customer_ic_dph && (
              <View style={{ flexDirection: "row" }}>
                <Text style={styles.label}>IČ DPH: </Text>
                <Text style={styles.value}>{invoice.customer_ic_dph}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bankové údaje */}
        {invoice.supplier_iban && (
          <View style={styles.bankInfo}>
            <Text style={styles.sectionTitle}>Platobné údaje</Text>
            <View style={{ flexDirection: "row", gap: 30 }}>
              <View>
                <Text style={styles.label}>IBAN</Text>
                <Text style={styles.boldValue}>{invoice.supplier_iban}</Text>
              </View>
              {invoice.supplier_bic && (
                <View>
                  <Text style={styles.label}>BIC/SWIFT</Text>
                  <Text style={styles.value}>{invoice.supplier_bic}</Text>
                </View>
              )}
              {invoice.variable_symbol && (
                <View>
                  <Text style={styles.label}>Variabilný symbol</Text>
                  <Text style={styles.boldValue}>{invoice.variable_symbol}</Text>
                </View>
              )}
              {invoice.constant_symbol && (
                <View>
                  <Text style={styles.label}>Konštantný symbol</Text>
                  <Text style={styles.value}>{invoice.constant_symbol}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Tabuľka položiek */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colDesc]}>Popis</Text>
            <Text style={[styles.headerText, styles.colQty]}>Mn.</Text>
            <Text style={[styles.headerText, styles.colUnit]}>MJ</Text>
            <Text style={[styles.headerText, styles.colPrice]}>Cena/MJ</Text>
            <Text style={[styles.headerText, styles.colVat]}>DPH %</Text>
            <Text style={[styles.headerText, styles.colBase]}>Základ</Text>
            <Text style={[styles.headerText, styles.colTotal]}>Celkom</Text>
          </View>
          {items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{item.unit}</Text>
              <Text style={styles.colPrice}>{formatMoney(item.unit_price, "")}</Text>
              <Text style={styles.colVat}>{item.vat_rate}%</Text>
              <Text style={styles.colBase}>{formatMoney(item.subtotal, "")}</Text>
              <Text style={styles.colTotal}>{formatMoney(item.total, "")}</Text>
            </View>
          ))}
        </View>

        {/* Súhrn */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Základ dane:</Text>
            <Text style={styles.totalValue}>{formatMoney(invoice.subtotal, invoice.currency)}</Text>
          </View>
          {Object.entries(vatGroups).map(([rate, group]) => (
            <View key={rate} style={styles.totalRow}>
              <Text style={styles.totalLabel}>DPH {rate}%:</Text>
              <Text style={styles.totalValue}>{formatMoney(group.vat, invoice.currency)}</Text>
            </View>
          ))}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Celkom k úhrade:</Text>
            <Text style={styles.grandTotalValue}>{formatMoney(invoice.total, invoice.currency)}</Text>
          </View>
        </View>

        {/* Reverse charge */}
        {invoice.reverse_charge && invoice.reverse_charge_text && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Prenesenie daňovej povinnosti</Text>
            <Text style={styles.notesText}>{invoice.reverse_charge_text}</Text>
          </View>
        )}

        {/* Poznámky */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Poznámka</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* QR kód */}
        {qrDataUrl && (
          <View style={styles.footer}>
            <View />
            <View style={styles.qrContainer}>
              <Image src={qrDataUrl} style={{ width: 80, height: 80 }} />
              <Text style={styles.qrLabel}>PAY by square</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  )
}
