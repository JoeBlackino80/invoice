// Pohoda XML Import/Export
// Supports Stormware Pohoda XML format for invoices, contacts, and journal entries

// ============ Interfaces ============

export interface PohodaInvoice {
  id: string
  invoiceType: "issuedInvoice" | "receivedInvoice"
  number: string
  symVar: string // variabilný symbol
  symConst: string // konštantný symbol
  symSpec: string // špecifický symbol
  date: string // dátum vystavenia
  dateTax: string // dátum zdaniteľného plnenia
  dateDue: string // dátum splatnosti
  dateAccounting: string // dátum zaúčtovania
  text: string // popis
  partnerIdentity: {
    id: string
    name: string
    ico: string
    dic: string
    icDph: string
    street: string
    city: string
    zip: string
    country: string
  }
  myIdentity: {
    name: string
    ico: string
    dic: string
    icDph: string
  }
  paymentType: string
  account: {
    bankCode: string
    accountNo: string
    iban: string
    swift: string
  }
  items: PohodaInvoiceItem[]
  currency: string
  exchangeRate: number
  totalWithoutVat: number
  totalVat: number
  totalWithVat: number
  note: string
  intNote: string
}

export interface PohodaInvoiceItem {
  text: string
  quantity: number
  unit: string
  coefficient: number
  payVAT: boolean
  rateVAT: "none" | "low" | "high" | "third"
  percentVAT: number
  homeCurrency: {
    unitPrice: number
    price: number
    priceVAT: number
    priceSum: number
  }
  foreignCurrency?: {
    unitPrice: number
    price: number
    priceVAT: number
    priceSum: number
  }
  stockItem?: {
    stockId: string
    name: string
    ean: string
  }
}

export interface PohodaContact {
  id: string
  name: string
  ico: string
  dic: string
  icDph: string
  street: string
  city: string
  zip: string
  country: string
  phone: string
  email: string
  web: string
  bankAccount: string
  iban: string
  swift: string
  note: string
  contactType: "firma" | "osoba"
}

export interface PohodaJournalEntry {
  id: string
  number: string
  date: string
  dateTax: string
  text: string
  symVar: string
  symConst: string
  items: PohodaJournalItem[]
  totalAmount: number
  note: string
}

export interface PohodaJournalItem {
  text: string
  md: string // MD účet (debit)
  dal: string // DAL účet (credit)
  amount: number
  symVar: string
  symConst: string
}

// ============ XML Parsing Helpers ============

function getTagContent(xml: string, tag: string): string {
  const regex = new RegExp(`<(?:[a-z]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-z]+:)?${tag}>`, "i")
  const match = xml.match(regex)
  return match ? match[1].trim() : ""
}

function getTagAttribute(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<(?:[a-z]+:)?${tag}[^>]*${attr}="([^"]*)"`, "i")
  const match = xml.match(regex)
  return match ? match[1].trim() : ""
}

function getAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:[a-z]+:)?${tag}[^>]*>[\\s\\S]*?</(?:[a-z]+:)?${tag}>`, "gi")
  const matches = xml.match(regex)
  return matches || []
}

function parseNumber(value: string): number {
  if (!value) return 0
  return parseFloat(value.replace(",", ".").replace(/\s/g, "")) || 0
}

function mapVatRate(rate: string): number {
  switch (rate.toLowerCase()) {
    case "high": return 20
    case "low": return 10
    case "third": return 5
    case "none": return 0
    default: return parseNumber(rate)
  }
}

// ============ Parse Functions ============

export function parsePohodaInvoices(xmlContent: string): PohodaInvoice[] {
  const invoices: PohodaInvoice[] = []

  // Find all invoice data packs
  const invoiceBlocks = getAllTags(xmlContent, "inv:invoice")
  if (invoiceBlocks.length === 0) {
    // Try alternative format
    const dataPacks = getAllTags(xmlContent, "dat:dataPackItem")
    for (const pack of dataPacks) {
      const invoiceContent = getTagContent(pack, "inv:invoice")
      if (invoiceContent) {
        invoiceBlocks.push(`<inv:invoice>${invoiceContent}</inv:invoice>`)
      }
    }
  }

  for (const block of invoiceBlocks) {
    const header = getTagContent(block, "inv:invoiceHeader")
    const detail = getTagContent(block, "inv:invoiceDetail")
    const summary = getTagContent(block, "inv:invoiceSummary")

    const invoiceType = getTagContent(header, "inv:invoiceType")
    const partnerBlock = getTagContent(header, "inv:partnerIdentity")
    const addressBlock = getTagContent(partnerBlock, "typ:address")
    const myBlock = getTagContent(header, "inv:myIdentity")
    const myAddr = getTagContent(myBlock, "typ:address")
    const accountBlock = getTagContent(header, "inv:account")

    const items: PohodaInvoiceItem[] = []
    const itemBlocks = getAllTags(detail, "inv:invoiceItem")
    for (const itemBlock of itemBlocks) {
      const homePrice = getTagContent(itemBlock, "inv:homeCurrency")
      const foreignPrice = getTagContent(itemBlock, "inv:foreignCurrency")
      const stockBlock = getTagContent(itemBlock, "inv:stockItem")

      const item: PohodaInvoiceItem = {
        text: getTagContent(itemBlock, "inv:text"),
        quantity: parseNumber(getTagContent(itemBlock, "inv:quantity")),
        unit: getTagContent(itemBlock, "inv:unit"),
        coefficient: parseNumber(getTagContent(itemBlock, "inv:coefficient")) || 1,
        payVAT: getTagContent(itemBlock, "inv:payVAT") === "true",
        rateVAT: (getTagContent(itemBlock, "inv:rateVAT") || "none") as "none" | "low" | "high" | "third",
        percentVAT: parseNumber(getTagContent(itemBlock, "inv:percentVAT")),
        homeCurrency: {
          unitPrice: parseNumber(getTagContent(homePrice, "typ:unitPrice")),
          price: parseNumber(getTagContent(homePrice, "typ:price")),
          priceVAT: parseNumber(getTagContent(homePrice, "typ:priceVAT")),
          priceSum: parseNumber(getTagContent(homePrice, "typ:priceSum")),
        },
      }

      if (foreignPrice) {
        item.foreignCurrency = {
          unitPrice: parseNumber(getTagContent(foreignPrice, "typ:unitPrice")),
          price: parseNumber(getTagContent(foreignPrice, "typ:price")),
          priceVAT: parseNumber(getTagContent(foreignPrice, "typ:priceVAT")),
          priceSum: parseNumber(getTagContent(foreignPrice, "typ:priceSum")),
        }
      }

      if (stockBlock) {
        item.stockItem = {
          stockId: getTagContent(stockBlock, "typ:id"),
          name: getTagContent(stockBlock, "typ:name"),
          ean: getTagContent(stockBlock, "typ:EAN"),
        }
      }

      items.push(item)
    }

    const homeSummary = getTagContent(summary, "inv:homeCurrency")

    const invoice: PohodaInvoice = {
      id: getTagContent(header, "inv:id"),
      invoiceType: (invoiceType === "receivedInvoice" ? "receivedInvoice" : "issuedInvoice") as "issuedInvoice" | "receivedInvoice",
      number: getTagContent(header, "inv:number") || getTagContent(getTagContent(header, "inv:number"), "typ:numberRequested"),
      symVar: getTagContent(header, "inv:symVar"),
      symConst: getTagContent(header, "inv:symConst"),
      symSpec: getTagContent(header, "inv:symSpec"),
      date: getTagContent(header, "inv:date"),
      dateTax: getTagContent(header, "inv:dateTax"),
      dateDue: getTagContent(header, "inv:dateDue"),
      dateAccounting: getTagContent(header, "inv:dateAccounting"),
      text: getTagContent(header, "inv:text"),
      partnerIdentity: {
        id: getTagContent(partnerBlock, "typ:id"),
        name: getTagContent(addressBlock, "typ:company"),
        ico: getTagContent(addressBlock, "typ:ico"),
        dic: getTagContent(addressBlock, "typ:dic"),
        icDph: getTagContent(addressBlock, "typ:icDph"),
        street: getTagContent(addressBlock, "typ:street"),
        city: getTagContent(addressBlock, "typ:city"),
        zip: getTagContent(addressBlock, "typ:zip"),
        country: getTagContent(getTagContent(addressBlock, "typ:country"), "typ:ids"),
      },
      myIdentity: {
        name: getTagContent(myAddr, "typ:company"),
        ico: getTagContent(myAddr, "typ:ico"),
        dic: getTagContent(myAddr, "typ:dic"),
        icDph: getTagContent(myAddr, "typ:icDph"),
      },
      paymentType: getTagContent(header, "inv:paymentType") || getTagContent(getTagContent(header, "inv:paymentType"), "typ:ids"),
      account: {
        bankCode: getTagContent(accountBlock, "typ:bankCode"),
        accountNo: getTagContent(accountBlock, "typ:accountNo"),
        iban: getTagContent(header, "inv:iban") || getTagContent(accountBlock, "typ:iban"),
        swift: getTagContent(header, "inv:swift") || getTagContent(accountBlock, "typ:swift"),
      },
      items,
      currency: getTagContent(getTagContent(summary, "inv:foreignCurrency"), "typ:currency") || "EUR",
      exchangeRate: parseNumber(getTagContent(getTagContent(summary, "inv:foreignCurrency"), "typ:rate")) || 1,
      totalWithoutVat: parseNumber(getTagContent(homeSummary, "typ:priceNone")) + parseNumber(getTagContent(homeSummary, "typ:priceLow")) + parseNumber(getTagContent(homeSummary, "typ:priceHigh")),
      totalVat: parseNumber(getTagContent(homeSummary, "typ:priceLowVAT")) + parseNumber(getTagContent(homeSummary, "typ:priceHighVAT")),
      totalWithVat: parseNumber(getTagContent(homeSummary, "typ:priceRound") || getTagContent(homeSummary, "typ:priceHighSum")),
      note: getTagContent(header, "inv:note"),
      intNote: getTagContent(header, "inv:intNote"),
    }

    invoices.push(invoice)
  }

  return invoices
}

export function parsePohodaContacts(xmlContent: string): PohodaContact[] {
  const contacts: PohodaContact[] = []

  const addressBookBlocks = getAllTags(xmlContent, "adb:addressbook")
  if (addressBookBlocks.length === 0) {
    const dataPacks = getAllTags(xmlContent, "dat:dataPackItem")
    for (const pack of dataPacks) {
      const content = getTagContent(pack, "adb:addressbook")
      if (content) {
        addressBookBlocks.push(`<adb:addressbook>${content}</adb:addressbook>`)
      }
    }
  }

  for (const block of addressBookBlocks) {
    const header = getTagContent(block, "adb:addressbookHeader")
    const address = getTagContent(header, "adb:address")
    const account = getTagContent(header, "adb:accountNumber") || getTagContent(header, "adb:account")

    const contact: PohodaContact = {
      id: getTagContent(header, "adb:id"),
      name: getTagContent(address, "typ:company") || getTagContent(address, "typ:name"),
      ico: getTagContent(address, "typ:ico"),
      dic: getTagContent(address, "typ:dic"),
      icDph: getTagContent(address, "typ:icDph"),
      street: getTagContent(address, "typ:street"),
      city: getTagContent(address, "typ:city"),
      zip: getTagContent(address, "typ:zip"),
      country: getTagContent(getTagContent(address, "typ:country"), "typ:ids") || "SK",
      phone: getTagContent(address, "typ:phone"),
      email: getTagContent(address, "typ:email"),
      web: getTagContent(address, "typ:web"),
      bankAccount: getTagContent(account, "typ:accountNo") || getTagContent(header, "adb:accountNumber"),
      iban: getTagContent(header, "adb:iban") || getTagContent(account, "typ:iban"),
      swift: getTagContent(header, "adb:swift") || getTagContent(account, "typ:swift"),
      note: getTagContent(header, "adb:note"),
      contactType: getTagContent(address, "typ:company") ? "firma" : "osoba",
    }

    contacts.push(contact)
  }

  return contacts
}

export function parsePohodaJournalEntries(xmlContent: string): PohodaJournalEntry[] {
  const entries: PohodaJournalEntry[] = []

  const intDocBlocks = getAllTags(xmlContent, "int:intDoc")
  if (intDocBlocks.length === 0) {
    const dataPacks = getAllTags(xmlContent, "dat:dataPackItem")
    for (const pack of dataPacks) {
      const content = getTagContent(pack, "int:intDoc")
      if (content) {
        intDocBlocks.push(`<int:intDoc>${content}</int:intDoc>`)
      }
    }
  }

  for (const block of intDocBlocks) {
    const header = getTagContent(block, "int:intDocHeader")
    const detail = getTagContent(block, "int:intDocDetail")

    const items: PohodaJournalItem[] = []
    const itemBlocks = getAllTags(detail, "int:intDocItem")
    for (const itemBlock of itemBlocks) {
      items.push({
        text: getTagContent(itemBlock, "int:text"),
        md: getTagContent(getTagContent(itemBlock, "int:md"), "typ:ids"),
        dal: getTagContent(getTagContent(itemBlock, "int:dal"), "typ:ids"),
        amount: parseNumber(getTagContent(getTagContent(itemBlock, "int:homeCurrency"), "typ:unitPrice")) ||
                parseNumber(getTagContent(itemBlock, "int:amount")),
        symVar: getTagContent(itemBlock, "int:symVar"),
        symConst: getTagContent(itemBlock, "int:symConst"),
      })
    }

    const entry: PohodaJournalEntry = {
      id: getTagContent(header, "int:id"),
      number: getTagContent(header, "int:number") || getTagContent(getTagContent(header, "int:number"), "typ:numberRequested"),
      date: getTagContent(header, "int:date"),
      dateTax: getTagContent(header, "int:dateTax"),
      text: getTagContent(header, "int:text"),
      symVar: getTagContent(header, "int:symVar"),
      symConst: getTagContent(header, "int:symConst"),
      items,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      note: getTagContent(header, "int:note"),
    }

    entries.push(entry)
  }

  return entries
}

// ============ Export Function ============

export function exportToPohodaXML(
  invoices: Array<{
    id: string
    number: string
    type: string
    issue_date: string
    tax_date: string
    due_date: string
    variable_symbol?: string
    constant_symbol?: string
    specific_symbol?: string
    contact_name?: string
    contact_ico?: string
    contact_dic?: string
    contact_ic_dph?: string
    contact_street?: string
    contact_city?: string
    contact_zip?: string
    payment_method?: string
    bank_account?: string
    iban?: string
    swift?: string
    currency?: string
    exchange_rate?: number
    note?: string
    items: Array<{
      description: string
      quantity: number
      unit: string
      unit_price: number
      vat_rate: number
      total_without_vat: number
      total_vat: number
      total_with_vat: number
    }>
    total_without_vat: number
    total_vat: number
    total_with_vat: number
  }>,
  contacts: Array<{
    id: string
    name: string
    ico?: string
    dic?: string
    ic_dph?: string
    street?: string
    city?: string
    zip?: string
    country?: string
    phone?: string
    email?: string
    web?: string
    bank_account?: string
    iban?: string
    swift?: string
    note?: string
  }>
): string {
  const escapeXml = (str: string | undefined | null): string => {
    if (!str) return ""
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
  }

  const mapVatRateToName = (rate: number): string => {
    if (rate >= 19) return "high"
    if (rate >= 9) return "low"
    if (rate > 0) return "third"
    return "none"
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<dat:dataPack xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd"
  xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd"
  xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd"
  xmlns:adb="http://www.stormware.cz/schema/version_2/addressbook.xsd"
  id="export" ico="" application="InvoiceApp" version="2.0"
  note="Exported from Invoice App">\n`

  // Export contacts
  for (const contact of contacts) {
    xml += `  <dat:dataPackItem id="ADR_${escapeXml(contact.id)}" version="2.0">
    <adb:addressbook version="2.0">
      <adb:addressbookHeader>
        <adb:identity>
          <typ:address>
            <typ:company>${escapeXml(contact.name)}</typ:company>
            <typ:ico>${escapeXml(contact.ico)}</typ:ico>
            <typ:dic>${escapeXml(contact.dic)}</typ:dic>
            <typ:icDph>${escapeXml(contact.ic_dph)}</typ:icDph>
            <typ:street>${escapeXml(contact.street)}</typ:street>
            <typ:city>${escapeXml(contact.city)}</typ:city>
            <typ:zip>${escapeXml(contact.zip)}</typ:zip>
            <typ:country>
              <typ:ids>${escapeXml(contact.country || "SK")}</typ:ids>
            </typ:country>
          </typ:address>
        </adb:identity>
        <adb:phone>${escapeXml(contact.phone)}</adb:phone>
        <adb:email>${escapeXml(contact.email)}</adb:email>
        <adb:web>${escapeXml(contact.web)}</adb:web>
        <adb:iban>${escapeXml(contact.iban)}</adb:iban>
        <adb:swift>${escapeXml(contact.swift)}</adb:swift>
        <adb:note>${escapeXml(contact.note)}</adb:note>
      </adb:addressbookHeader>
    </adb:addressbook>
  </dat:dataPackItem>\n`
  }

  // Export invoices
  for (const inv of invoices) {
    const isReceived = inv.type === "received" || inv.type === "prijata"
    const invoiceType = isReceived ? "receivedInvoice" : "issuedInvoice"

    xml += `  <dat:dataPackItem id="INV_${escapeXml(inv.id)}" version="2.0">
    <inv:invoice version="2.0">
      <inv:invoiceHeader>
        <inv:invoiceType>${invoiceType}</inv:invoiceType>
        <inv:number>
          <typ:numberRequested>${escapeXml(inv.number)}</typ:numberRequested>
        </inv:number>
        <inv:symVar>${escapeXml(inv.variable_symbol)}</inv:symVar>
        <inv:symConst>${escapeXml(inv.constant_symbol)}</inv:symConst>
        <inv:symSpec>${escapeXml(inv.specific_symbol)}</inv:symSpec>
        <inv:date>${inv.issue_date}</inv:date>
        <inv:dateTax>${inv.tax_date}</inv:dateTax>
        <inv:dateDue>${inv.due_date}</inv:dateDue>
        <inv:partnerIdentity>
          <typ:address>
            <typ:company>${escapeXml(inv.contact_name)}</typ:company>
            <typ:ico>${escapeXml(inv.contact_ico)}</typ:ico>
            <typ:dic>${escapeXml(inv.contact_dic)}</typ:dic>
            <typ:icDph>${escapeXml(inv.contact_ic_dph)}</typ:icDph>
            <typ:street>${escapeXml(inv.contact_street)}</typ:street>
            <typ:city>${escapeXml(inv.contact_city)}</typ:city>
            <typ:zip>${escapeXml(inv.contact_zip)}</typ:zip>
          </typ:address>
        </inv:partnerIdentity>
        <inv:note>${escapeXml(inv.note)}</inv:note>
      </inv:invoiceHeader>
      <inv:invoiceDetail>\n`

    for (const item of inv.items) {
      const vatRateName = mapVatRateToName(item.vat_rate)
      xml += `        <inv:invoiceItem>
          <inv:text>${escapeXml(item.description)}</inv:text>
          <inv:quantity>${item.quantity}</inv:quantity>
          <inv:unit>${escapeXml(item.unit)}</inv:unit>
          <inv:coefficient>1.0</inv:coefficient>
          <inv:payVAT>${item.vat_rate > 0 ? "true" : "false"}</inv:payVAT>
          <inv:rateVAT>${vatRateName}</inv:rateVAT>
          <inv:percentVAT>${item.vat_rate}</inv:percentVAT>
          <inv:homeCurrency>
            <typ:unitPrice>${item.unit_price}</typ:unitPrice>
            <typ:price>${item.total_without_vat}</typ:price>
            <typ:priceVAT>${item.total_vat}</typ:priceVAT>
            <typ:priceSum>${item.total_with_vat}</typ:priceSum>
          </inv:homeCurrency>
        </inv:invoiceItem>\n`
    }

    xml += `      </inv:invoiceDetail>
      <inv:invoiceSummary>
        <inv:roundingDocument>math2one</inv:roundingDocument>
        <inv:homeCurrency>
          <typ:priceNone>${inv.total_without_vat}</typ:priceNone>
          <typ:priceHighVAT>${inv.total_vat}</typ:priceHighVAT>
          <typ:priceRound>${inv.total_with_vat}</typ:priceRound>
        </inv:homeCurrency>`

    if (inv.currency && inv.currency !== "EUR") {
      xml += `
        <inv:foreignCurrency>
          <typ:currency>
            <typ:ids>${escapeXml(inv.currency)}</typ:ids>
          </typ:currency>
          <typ:rate>${inv.exchange_rate || 1}</typ:rate>
        </inv:foreignCurrency>`
    }

    xml += `
      </inv:invoiceSummary>
    </inv:invoice>
  </dat:dataPackItem>\n`
  }

  xml += `</dat:dataPack>`
  return xml
}
