import { jsPDF } from 'jspdf'

// Brand tokens mirroring tailwind.config.js so the invoice reads as part of
// the same product as the app (primary, ink, muted, border, primary-light).
const C = {
  primary: [6, 148, 148],
  primaryDark: [4, 120, 120],
  primaryLight: [224, 244, 244],
  surface: [250, 250, 250],
  ink: [15, 23, 42],
  muted: [100, 116, 139],
  border: [226, 232, 240],
  white: [255, 255, 255],
  paidBg: [209, 250, 229],
  paidText: [4, 120, 86],
  idleBg: [241, 245, 249],
}

const PAGE_W = 210
const MARGIN = 16
const RIGHT = PAGE_W - MARGIN

const METHOD_LABELS = { card: 'Card', debit: 'Debit card', netbanking: 'Net banking', upi: 'UPI' }
const FREQ_LABELS = { monthly: 'Monthly', annual: 'Annual' }

function money(n) {
  return `$${Number(n || 0).toLocaleString('en-US')}`
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function fill(doc, color) {
  doc.setFillColor(color[0], color[1], color[2])
}

function stroke(doc, color) {
  doc.setDrawColor(color[0], color[1], color[2])
}

function textColor(doc, color) {
  doc.setTextColor(color[0], color[1], color[2])
}

// White rounded chip with the teal map pin, matching the header logo in
// src/components/common/Header.jsx.
function drawLogo(doc, x, y, size) {
  fill(doc, C.white)
  doc.roundedRect(x, y, size, size, 2.6, 2.6, 'F')

  const cx = x + size / 2
  const headY = y + size * 0.42
  fill(doc, C.primary)
  doc.circle(cx, headY, size * 0.24, 'F')
  doc.triangle(cx - size * 0.17, headY + size * 0.1, cx + size * 0.17, headY + size * 0.1, cx, y + size * 0.82, 'F')
  fill(doc, C.white)
  doc.circle(cx, headY - size * 0.03, size * 0.09, 'F')
}

function label(doc, text, x, y, align) {
  textColor(doc, C.primary)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text(text, x, y, align ? { align } : undefined)
}

function value(doc, text, x, y, { bold = false, size = 10.5, color = C.ink, align } = {}) {
  textColor(doc, color)
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  doc.text(text, x, y, align ? { align } : undefined)
}

function card(doc, x, y, w, h) {
  fill(doc, C.white)
  stroke(doc, C.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 3, 3, 'FD')
}

function statusBadge(doc, status, xRight, y) {
  const text = String(status || 'pending').toUpperCase()
  const w = Math.max(24, text.length * 2.2 + 10)
  const h = 8.5
  const paid = status === 'paid'
  fill(doc, paid ? C.paidBg : C.idleBg)
  doc.roundedRect(xRight - w, y, w, h, h / 2, h / 2, 'F')
  textColor(doc, paid ? C.paidText : C.muted)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(text, xRight - w / 2, y + h / 2 + 1.4, { align: 'center' })
  return w
}

function infoCard(doc, order, y) {
  const h = 26
  fill(doc, C.primaryLight)
  doc.roundedRect(MARGIN, y, RIGHT - MARGIN, h, 3, 3, 'F')
  fill(doc, C.primary)
  doc.roundedRect(MARGIN, y, 2.4, h, 1.2, 1.2, 'F')

  const paid = order.status === 'paid'
  textColor(doc, C.primaryDark)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(paid ? 'Payment received' : 'Payment pending', MARGIN + 7, y + 9)

  textColor(doc, C.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const body = paid
    ? `Paid on ${formatDate(order.created_at)} with ${METHOD_LABELS[order.payment_method] || 'card'}. A copy of this invoice is always available in your CyraCode account under Orders & Invoices.`
    : 'This invoice will be marked as paid once the transaction completes. Your plan stays active in the meantime.'
  doc.text(doc.splitTextToSize(body, RIGHT - MARGIN - 14), MARGIN + 7, y + 15)
}

/**
 * Builds the branded CyraCode invoice for one order as a jsPDF document.
 * Layout: teal brand header, details card, line-item card, totals pill,
 * payment status card and a footer band - same tokens as the web app.
 */
export function buildInvoicePdf(order) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setProperties({
    title: `Invoice ${order.order_no} - CyraCode`,
    subject: `CyraCode invoice for ${order.plan_name}`,
    creator: 'CyraCode',
  })

  // Page background + brand header.
  fill(doc, C.surface)
  doc.rect(0, 0, PAGE_W, 297, 'F')
  fill(doc, C.primary)
  doc.rect(0, 0, PAGE_W, 33, 'F')
  fill(doc, C.primaryDark)
  doc.rect(0, 33, PAGE_W, 1.5, 'F')

  drawLogo(doc, MARGIN, 10, 11)
  value(doc, 'CyraCode', MARGIN + 14, 17.5, { bold: true, size: 16, color: C.white })
  value(doc, 'Universal Address Naming', MARGIN + 14, 23, { size: 8.5, color: C.white })

  value(doc, 'INVOICE', RIGHT, 17.5, { bold: true, size: 20, color: C.white, align: 'right' })
  value(doc, order.order_no || '', RIGHT, 23.5, { size: 9.5, color: C.white, align: 'right' })

  // Details card: billing email, dates and status badge.
  const c1Y = 43
  card(doc, MARGIN, c1Y, RIGHT - MARGIN, 36)
  const col1 = MARGIN + 6
  const col2 = 95
  const col3Right = RIGHT - 6

  label(doc, 'BILLED TO', col1, c1Y + 8.5)
  const emailLines = doc.splitTextToSize(order.email || '—', 68)
  value(doc, emailLines[0], col1, c1Y + 15, { bold: true, size: 11 })

  label(doc, 'INVOICE DATE', col2, c1Y + 8.5)
  value(doc, formatDate(order.created_at), col2, c1Y + 15, { bold: true, size: 11 })

  label(doc, 'BILLING', col3Right, c1Y + 8.5, 'right')
  value(doc, FREQ_LABELS[order.billing_frequency] || order.billing_frequency || '—', col3Right, c1Y + 15, {
    size: 10.5,
    align: 'right',
  })

  label(doc, 'PAYMENT METHOD', col1, c1Y + 23)
  value(doc, METHOD_LABELS[order.payment_method] || 'Card', col1, c1Y + 29.5, { size: 10.5 })

  label(doc, 'CURRENCY', col2, c1Y + 23)
  value(doc, order.currency || 'USD', col2, c1Y + 29.5, { size: 10.5 })

  label(doc, 'STATUS', col3Right, c1Y + 23, 'right')
  statusBadge(doc, order.status, col3Right, c1Y + 25)

  // Line items card.
  const c2Y = 87
  card(doc, MARGIN, c2Y, RIGHT - MARGIN, 36)
  fill(doc, C.primaryLight)
  doc.roundedRect(MARGIN + 2, c2Y + 2, RIGHT - MARGIN - 4, 8.5, 2.5, 2.5, 'F')
  label(doc, 'DESCRIPTION', MARGIN + 5.5, c2Y + 7.5)
  label(doc, 'BILLING', 100, c2Y + 7.5)
  label(doc, `AMOUNT (${order.currency || 'USD'})`, RIGHT - 5.5, c2Y + 7.5, 'right')

  value(doc, order.plan_name || '—', MARGIN + 5.5, c2Y + 19, { bold: true, size: 10.5 })
  value(doc, FREQ_LABELS[order.billing_frequency] || order.billing_frequency || '—', 100, c2Y + 19, {
    size: 9.5,
    color: C.muted,
  })
  value(doc, money(order.amount), RIGHT - 5.5, c2Y + 19, { bold: true, size: 10.5, align: 'right' })

  stroke(doc, C.border)
  doc.setLineWidth(0.3)
  doc.line(MARGIN + 5.5, c2Y + 25, RIGHT - 5.5, c2Y + 25)
  value(doc, 'Subscription charge', MARGIN + 5.5, c2Y + 31, { size: 8, color: C.muted })

  // Totals.
  const tX = 112
  value(doc, 'Subtotal', tX, 131, { size: 9.5, color: C.muted })
  value(doc, money(order.amount), RIGHT, 131, { size: 9.5, align: 'right' })
  value(doc, 'Tax', tX, 138, { size: 9.5, color: C.muted })
  value(doc, money(order.tax_amount), RIGHT, 138, { size: 9.5, align: 'right' })

  fill(doc, C.primary)
  doc.roundedRect(tX, 144, RIGHT - tX, 12, 3, 3, 'F')
  value(doc, 'Total', tX + 4, 151.7, { bold: true, size: 11, color: C.white })
  value(doc, `${money(order.total_amount)} ${order.currency || 'USD'}`, RIGHT - 4, 151.7, {
    bold: true,
    size: 11,
    color: C.white,
    align: 'right',
  })

  infoCard(doc, order, 166)

  // Footer.
  stroke(doc, C.border)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, 252, RIGHT, 252)
  value(doc, 'Thank you for using CyraCode.', MARGIN, 259, { bold: true, size: 10 })
  value(doc, 'Questions? support@cyracode.com', MARGIN, 264, { size: 8.5, color: C.muted })
  value(doc, `Invoice ${order.order_no || ''}`, RIGHT, 259, { size: 8.5, color: C.muted, align: 'right' })
  value(doc, 'cyracode.com', RIGHT, 264, { bold: true, size: 9.5, color: C.primary, align: 'right' })

  fill(doc, C.primary)
  doc.rect(0, 284, PAGE_W, 13, 'F')
  value(doc, 'Give any location a memorable name.', PAGE_W / 2, 291.7, {
    size: 8.5,
    color: C.white,
    align: 'center',
  })

  return doc
}

export function invoiceFileName(order) {
  return `invoice-${String(order?.order_no || 'cyracode').toLowerCase()}.pdf`
}

export function downloadInvoicePdf(order) {
  const blob = buildInvoicePdf(order).output('blob')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = invoiceFileName(order)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
