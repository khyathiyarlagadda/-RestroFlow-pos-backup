import qz from 'qz-tray';
import type { SaleInvoice } from '../types';
import { generateCustomerBillHTML, generateKOTHTML } from './printReceipt';

export interface QZPrintResult {
  success: boolean;
  customerPrinted: boolean;
  kotPrinted: boolean;
  error?: string;
}

/**
 * Checks whether QZ Tray WebSocket is connected.
 */
export function isQZConnected(): boolean {
  try {
    return qz.websocket.isConnected();
  } catch {
    return false;
  }
}

/**
 * Establishes WebSocket connection to local QZ Tray instance.
 */
export async function connectQZ(): Promise<boolean> {
  if (isQZConnected()) {
    return true;
  }
  try {
    await qz.websocket.connect({ retries: 2, delay: 1 });
    return isQZConnected();
  } catch (err: any) {
    console.warn('[QZ Printer] Could not connect to QZ Tray:', err?.message || err);
    return false;
  }
}

/**
 * Disconnects from QZ Tray.
 */
export async function disconnectQZ(): Promise<void> {
  try {
    if (isQZConnected()) {
      await qz.websocket.disconnect();
    }
  } catch (err) {
    console.warn('[QZ Printer] Error disconnecting QZ Tray:', err);
  }
}

/**
 * Returns list of all installed printers discovered by QZ Tray.
 */
export async function getPrinters(): Promise<string[]> {
  const connected = await connectQZ();
  if (!connected) return [];
  try {
    const res = await qz.printers.find();
    if (Array.isArray(res)) return res;
    if (typeof res === 'string') return [res];
    return [];
  } catch (err) {
    console.error('[QZ Printer] Error discovering printers:', err);
    return [];
  }
}

/**
 * Finds default system printer or first available thermal printer.
 */
export async function getDefaultPrinter(): Promise<string | null> {
  const connected = await connectQZ();
  if (!connected) return null;
  try {
    const defaultPrinter = await qz.printers.getDefault();
    if (defaultPrinter) return defaultPrinter;
    const allPrinters = await getPrinters();
    return allPrinters.length > 0 ? allPrinters[0] : null;
  } catch (err) {
    console.warn('[QZ Printer] Error fetching default printer:', err);
    try {
      const printers = await getPrinters();
      return printers.length > 0 ? printers[0] : null;
    } catch {
      return null;
    }
  }
}

/**
 * Wraps individual receipt section HTML in full document boilerplate for QZ Tray thermal pixel printing.
 */
function wrapHTMLForQZ(bodyHTML: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    @page { margin: 2mm; size: auto; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, monospace, sans-serif;
      font-size: 11px;
      line-height: 1.25;
      font-weight: 600;
    }
    .receipt-container {
      width: 100%;
      max-width: 80mm;
      margin: 0 auto;
      padding: 2px;
    }
    .receipt-section {
      display: block;
      width: 100%;
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
    .divider { border: none; margin: 4px 0; }
    .border-solid { border-top: 1px solid #000000; }
    .border-dash { border-top: 1px dashed #000000; }
    .items-table { width: 100%; border-collapse: collapse; margin: 2px 0; }
    .items-table th, .items-table td { padding: 1px 0; vertical-align: top; }
    .italic { font-style: italic; }
  </style>
</head>
<body>
  <div class="receipt-container">
    ${bodyHTML}
  </div>
</body>
</html>`;
}

/**
 * Sends a single HTML print job directly to specified printer via QZ Tray (80mm width).
 */
export async function printHTMLJob(printerName: string, htmlContent: string): Promise<void> {
  const config = qz.configs.create(printerName, {
    size: { width: 80, mm: true },
    units: 'mm',
    colorType: 'color'
  });

  const data = [
    {
      type: 'pixel',
      format: 'html',
      flavor: 'plain',
      data: htmlContent
    }
  ];

  await qz.print(config, data);
}

/**
 * High-level QZ Tray thermal receipt execution for Save & Print.
 * Executes Customer Bill as Job 1, and KOT as Job 2 independently.
 */
export async function printReceiptQZ(
  invoice: SaleInvoice,
  selection: 'both' | 'customer' | 'kot' = 'both'
): Promise<QZPrintResult> {
  const connected = await connectQZ();
  if (!connected) {
    return {
      success: false,
      customerPrinted: false,
      kotPrinted: false,
      error: 'QZ Tray is not running. Please start QZ Tray to print.'
    };
  }

  const printer = await getDefaultPrinter();
  if (!printer) {
    return {
      success: false,
      customerPrinted: false,
      kotPrinted: false,
      error: 'No default thermal printer found in QZ Tray.'
    };
  }

  let customerPrinted = false;
  let kotPrinted = false;

  try {
    // JOB 1: Customer Bill
    if (selection === 'customer' || selection === 'both') {
      const customerHTML = wrapHTMLForQZ(generateCustomerBillHTML(invoice));
      await printHTMLJob(printer, customerHTML);
      customerPrinted = true;
    }

    // JOB 2: KOT
    if (selection === 'kot' || selection === 'both') {
      const kotHTML = wrapHTMLForQZ(generateKOTHTML(invoice));
      await printHTMLJob(printer, kotHTML);
      kotPrinted = true;
    }

    return {
      success: true,
      customerPrinted,
      kotPrinted
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error('[QZ Printer] Print error:', err);

    return {
      success: false,
      customerPrinted,
      kotPrinted,
      error: errorMsg
    };
  }
}
