import type { SaleInvoice } from '../types';
import { storage } from './storage';

export const getBillNumber = (invoice: any) => {
  if (invoice.id) {
    const cleanId = invoice.id.replace(/[^a-zA-Z0-9]/g, '');
    return cleanId.slice(-6).toUpperCase();
  }
  let hash = 0;
  const str = invoice.tokenNo || '';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash).toString().slice(-6).padStart(6, '0');
};

export const generateCustomerBillHTML = (invoice: SaleInvoice): string => {
  const settings = storage.getSettings();
  const cashier = storage.getAuth()?.username || 'System';
  const tokenDisplay = invoice.tokenNo ? invoice.tokenNo.split('-').pop() : '';
  const billNo = getBillNumber(invoice);

  const formattedDate = new Date(invoice.dateTime).toLocaleDateString('en-GB');
  const formattedTime = new Date(invoice.dateTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return `
    <section class="receipt-section customer-bill">
      <div class="header text-center">
        <div class="restaurant-title">${settings.restaurantName || 'RestroFlow'}</div>
        ${settings.address ? `<div class="info-line">${settings.address}</div>` : ''}
        ${settings.phone ? `<div class="info-line">Phone: ${settings.phone}</div>` : ''}
      </div>

      <div class="divider border-solid"></div>

      <div class="text-left">
        Customer : ${invoice.customerName || 'Walk-in Customer'}
      </div>

      <div class="divider border-solid"></div>

      <div class="order-info">
        <div class="flex-row">
          <span>Date : ${formattedDate}</span>
          <span>Time : ${formattedTime}</span>
        </div>
        <div class="flex-row">
          <span>Token : ${tokenDisplay}</span>
          <span>Bill : ${billNo}</span>
        </div>
        <div>Cashier : ${cashier}</div>
        <div>Type : ${invoice.orderType}${invoice.tableNo ? ` (Table ${invoice.tableNo})` : ''}</div>
      </div>

      <div class="divider border-solid"></div>

      <table class="items-table">
        <thead>
          <tr>
            <th class="text-left" style="width:45%">Item</th>
            <th class="text-center" style="width:15%">Qty</th>
            <th class="text-right" style="width:20%">Price</th>
            <th class="text-right" style="width:20%">Total</th>
          </tr>
        </thead>
      </table>
      <div class="divider border-solid"></div>
      <table class="items-table">
        <tbody>
          ${invoice.items
            .map(
              (item) => `
            <tr>
              <td class="text-left" style="width:45%">${item.name}${item.variationName ? ` (${item.variationName})` : ''}</td>
              <td class="text-center" style="width:15%">${item.quantity}</td>
              <td class="text-right" style="width:20%">₹${item.price.toFixed(2)}</td>
              <td class="text-right" style="width:20%">₹${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="divider border-solid"></div>

      <div class="totals-block">
        <div class="flex-row">
          <span>Total Qty : ${invoice.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
          <span>Subtotal : ₹${invoice.subtotal.toFixed(2)}</span>
        </div>
        ${
          invoice.discount > 0
            ? `<div class="flex-row"><span>Discount</span><span>-₹${invoice.discount.toFixed(2)}</span></div>`
            : ''
        }
        ${
          invoice.roundOff !== 0
            ? `<div class="flex-row"><span>Round Off</span><span>₹${invoice.roundOff.toFixed(2)}</span></div>`
            : ''
        }
        <div class="divider border-solid"></div>
        <div class="flex-row grand-total">
          <span>Grand Total</span>
          <span>₹${invoice.grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div class="divider border-solid"></div>

      <div class="footer text-center">
        <div>Thank You!</div>
        <div>Visit Again.</div>
      </div>
    </section>
  `;
};

export const generateKOTHTML = (invoice: SaleInvoice): string => {
  const tokenDisplay = invoice.tokenNo ? invoice.tokenNo.split('-').pop() : '';
  const formattedDate = new Date(invoice.dateTime).toLocaleDateString('en-GB');
  const formattedTime12 = new Date(invoice.dateTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return `
    <section class="receipt-section kot">
      <div class="header text-center font-bold text-lg">
        KITCHEN ORDER TICKET
      </div>

      <div class="divider border-solid"></div>

      <div class="order-info font-bold">
        <div>Token No: ${tokenDisplay}</div>
        <div>Date: ${formattedDate}</div>
        <div>Time: ${formattedTime12}</div>
      </div>

      <div class="divider border-solid"></div>

      <table class="items-table font-bold">
        <thead>
          <tr>
            <th class="text-left" style="width:85%">Item</th>
            <th class="text-right" style="width:15%">Qty</th>
          </tr>
        </thead>
      </table>

      <div class="divider border-solid"></div>

      <table class="items-table font-bold">
        <tbody>
          ${invoice.items
            .map(
              (item) => `
            <tr>
              <td class="text-left" style="width:85%">${item.name}${item.variationName ? ` (${item.variationName})` : ''}</td>
              <td class="text-right" style="width:15%">${item.quantity}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="divider border-solid"></div>
    </section>
  `;
};

export const generateFullReceiptDocument = (
  invoice: SaleInvoice,
  selection: 'both' | 'customer' | 'kot' = 'both'
): string => {
  const renderCustomer = selection === 'customer' || selection === 'both';
  const renderKot = selection === 'kot' || selection === 'both';
  const renderBreak = selection === 'both';

  const customerHTML = renderCustomer ? generateCustomerBillHTML(invoice) : '';
  const kotHTML = renderKot ? generateKOTHTML(invoice) : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Receipt Print</title>
  <style>
    @page {
      margin: 4mm;
      size: auto;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.25;
      font-weight: 600;
    }
    .receipt-container {
      width: 100%;
      max-width: 80mm;
      margin: 0 auto;
      padding: 4px;
    }
    .receipt-section {
      display: block;
      page-break-inside: avoid;
      break-inside: avoid;
      width: 100%;
    }
    .page-break {
      display: block;
      page-break-after: always;
      break-after: page;
      height: 0;
      margin: 0;
      padding: 0;
      border: none;
      visibility: hidden;
      clear: both;
    }
    .flex-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 800; }
    .text-lg { font-size: 14px; text-transform: uppercase; }
    .restaurant-title { font-size: 14px; font-weight: 800; text-transform: uppercase; }
    .info-line { font-size: 10px; }
    .grand-total { font-size: 14px; font-weight: 800; }
    .divider {
      border: none;
      margin: 4px 0;
    }
    .border-solid {
      border-top: 1px solid #000000;
    }
    .border-dash {
      border-top: 1px dashed #000000;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 2px 0;
    }
    .items-table th, .items-table td {
      padding: 1px 0;
      vertical-align: top;
    }
    .italic { font-style: italic; }
  </style>
</head>
<body>
  <div class="receipt-container">
    ${renderCustomer ? customerHTML : ''}
    ${renderBreak ? '<div class="page-break"></div>' : ''}
    ${renderKot ? kotHTML : ''}
  </div>
</body>
</html>`;
};

/**
  Prints receipt slips in a completely isolated, temporary hidden iframe.
  Kept as fallback when QZ Tray is not running or unavailable.
 */
export const printReceiptIsolated = (
  invoice: SaleInvoice,
  selection: 'both' | 'customer' | 'kot' = 'both'
) => {
  const fullHTML = generateFullReceiptDocument(invoice, selection);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(fullHTML);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 150);
  }
};

/**
  Prints split bill receipts in a dedicated hidden iframe.
 */
export const printSplitReceiptIsolated = (
  grandTotal: number,
  splitMembers: number,
  orderType: string,
  tableNumber?: string
) => {
  const settings = storage.getSettings();
  const perPersonShare = (Math.round((grandTotal / splitMembers) * 100) / 100).toFixed(2);

  const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Split Bill Print</title>
  <style>
    @page { margin: 4mm; size: auto; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #000000; font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.3; }
    .container { width: 100%; max-width: 80mm; margin: 0 auto; padding: 4px; }
    .text-center { text-align: center; }
    .flex-row { display: flex; justify-content: space-between; }
    .font-bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000000; margin: 6px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="text-center">
      <div style="font-size: 15px; font-weight: bold;">${settings.restaurantName || 'RestroFlow'}</div>
      <div style="font-size: 12px; font-weight: bold;">SPLIT BILL RECEIPT</div>
    </div>
    <div class="divider"></div>
    <div>Date: ${new Date().toLocaleDateString()}</div>
    <div>Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    ${orderType === 'Dine In' && tableNumber ? `<div>Table: ${tableNumber}</div>` : ''}
    <div class="divider"></div>
    <div class="flex-row"><span>Total Amount:</span><span>₹${grandTotal.toFixed(2)}</span></div>
    <div class="flex-row"><span>No. of Members:</span><span>${splitMembers}</span></div>
    <div class="divider"></div>
    <div class="flex-row font-bold" style="font-size: 14px;"><span>Per Person Pay:</span><span>₹${perPersonShare}</span></div>
    <div class="divider"></div>
    <div class="text-center" style="font-size: 10px;">Thank you! Please pay your share.</div>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(fullHTML);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 150);
  }
};
