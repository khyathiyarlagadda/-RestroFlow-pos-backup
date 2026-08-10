import qz from 'qz-tray';
import type { SaleInvoice } from '../types';
import { generateCustomerBillHTML, generateKOTHTML } from './printReceipt';

export interface QZPrintResult {
  success: boolean;
  customerPrinted: boolean;
  kotPrinted: boolean;
  error?: string;
}

export interface QZConnectionStatus {
  connected: boolean;
  error?: string;
}

/**
 * Checks whether QZ Tray WebSocket is currently connected.
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
 * Returns connection status object containing exact error details if connection fails.
 */
export async function connectQZStatus(): Promise<QZConnectionStatus> {
  if (isQZConnected()) {
    return { connected: true };
  }

  try {
    console.log('[QZ Printer] Attempting WebSocket connection to QZ Tray...');
    // Increased retries to 10 with 1 second delay to allow sufficient time
    // for user interaction with desktop security permission popups on HTTPS Vercel deployments.
    await qz.websocket.connect({ retries: 10, delay: 1, keepAlive: 60 });
    const connected = isQZConnected();
    if (connected) {
      console.log('[QZ Printer] WebSocket connection established successfully.');
      return { connected: true };
    } else {
      const errStr = 'Connection attempt finished but qz.websocket.isConnected() returned false.';
      console.error(`[QZ Printer] ${errStr}`);
      return { connected: false, error: errStr };
    }
  } catch (err: any) {
    const rawErrorMsg = err?.message || String(err);
    console.error('[QZ Printer] Connection error:', err);
    return {
      connected: false,
      error: rawErrorMsg
    };
  }
}

/**
 * Convenience wrapper returning boolean status for connection checks.
 */
export async function connectQZ(): Promise<boolean> {
  const status = await connectQZStatus();
  return status.connected;
}

/**
 * Disconnects from QZ Tray WebSocket.
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
  const status = await connectQZStatus();
  if (!status.connected) {
    console.warn('[QZ Printer] Cannot discover printers: QZ Tray not connected.', status.error);
    return [];
  }
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
  const status = await connectQZStatus();
  if (!status.connected) {
    console.warn('[QZ Printer] Cannot get default printer: QZ Tray not connected.', status.error);
    return null;
  }
  try {
    const defaultPrinter = await qz.printers.getDefault();
    if (defaultPrinter) return defaultPrinter;
    const allPrinters = await getPrinters();
    return allPrinters.length > 0 ? allPrinters[0] : null;
  } catch (err) {
    console.warn('[QZ Printer] Error fetching default printer, checking printer list fallback:', err);
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
  const connStatus = await connectQZStatus();
  if (!connStatus.connected) {
    const errorMsg = connStatus.error || 'QZ Tray connection unavailable.';
    console.error('[QZ Printer] Print process stopped: connection failed:', errorMsg);
    return {
      success: false,
      customerPrinted: false,
      kotPrinted: false,
      error: `QZ Tray Connection Failed: ${errorMsg}`
    };
  }

  let printer: string | null = null;
  try {
    printer = await getDefaultPrinter();
  } catch (err: any) {
    const discoveryError = err?.message || String(err);
    console.error('[QZ Printer] Printer discovery failed:', err);
    return {
      success: false,
      customerPrinted: false,
      kotPrinted: false,
      error: `Printer Discovery Failed: ${discoveryError}`
    };
  }

  if (!printer) {
    console.error('[QZ Printer] No default printer found.');
    return {
      success: false,
      customerPrinted: false,
      kotPrinted: false,
      error: 'No default thermal printer found in QZ Tray. Please set a default printer in Windows settings.'
    };
  }

  console.log(`[QZ Printer] Target printer identified: "${printer}"`);
  let customerPrinted = false;
  let kotPrinted = false;

  // JOB 1: Customer Bill
  if (selection === 'customer' || selection === 'both') {
    try {
      console.log('[QZ Printer] Sending Job 1 (Customer Bill)...');
      const customerHTML = wrapHTMLForQZ(generateCustomerBillHTML(invoice));
      await printHTMLJob(printer, customerHTML);
      customerPrinted = true;
      console.log('[QZ Printer] Job 1 (Customer Bill) printed successfully.');
    } catch (err: any) {
      const job1Err = err?.message || String(err);
      console.error('[QZ Printer] Job 1 (Customer Bill) failed:', err);
      return {
        success: false,
        customerPrinted: false,
        kotPrinted: false,
        error: `Customer Bill Print Job Failed: ${job1Err}`
      };
    }
  }

  // JOB 2: KOT
  if (selection === 'kot' || selection === 'both') {
    try {
      console.log('[QZ Printer] Sending Job 2 (KOT)...');
      const kotHTML = wrapHTMLForQZ(generateKOTHTML(invoice));
      await printHTMLJob(printer, kotHTML);
      kotPrinted = true;
      console.log('[QZ Printer] Job 2 (KOT) printed successfully.');
    } catch (err: any) {
      const job2Err = err?.message || String(err);
      console.error('[QZ Printer] Job 2 (KOT) failed:', err);
      return {
        success: false,
        customerPrinted,
        kotPrinted: false,
        error: customerPrinted
          ? `Customer Bill printed, but KOT failed: ${job2Err}`
          : `KOT Print Job Failed: ${job2Err}`
      };
    }
  }

  return {
    success: true,
    customerPrinted,
    kotPrinted
  };
}
