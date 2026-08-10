import qz from 'qz-tray';
import type { SaleInvoice } from '../types';
import { generateCustomerBillHTML, generateKOTHTML } from './printReceipt';

export interface QZPrintResult {
  success: boolean;
  customerPrinted: boolean;
  kotPrinted: boolean;
  error?: string;
}

// In-flight connection promise to prevent duplicate concurrent connection calls
let connectionPromise: Promise<void> | null = null;

/**
 * Checks whether QZ Tray WebSocket connection is active.
 * Checks both qz.websocket.isActive() and qz.websocket.isConnected().
 */
export function isQZActive(): boolean {
  try {
    if (typeof qz?.websocket?.isActive === 'function' && qz.websocket.isActive()) {
      return true;
    }
    if (typeof qz?.websocket?.isConnected === 'function' && qz.websocket.isConnected()) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Idempotent QZ Tray connection manager.
 * - If connection is already active, returns immediately without re-connecting.
 * - If a connection attempt is in progress, reuses and awaits that exact promise.
 * - Only invokes qz.websocket.connect() once when no active connection exists.
 */
export async function connectQZ(): Promise<void> {
  // 1. Reuse existing active connection
  if (isQZActive()) {
    console.log('[QZ Printer] Connection already active. Reusing active session.');
    return;
  }

  // 2. Reuse in-flight connection promise
  if (connectionPromise) {
    console.log('[QZ Printer] Connection attempt already in progress. Awaiting existing promise.');
    return connectionPromise;
  }

  // 3. Initiate single connection attempt
  connectionPromise = (async () => {
    try {
      console.log('[QZ Printer] Initiating QZ Tray WebSocket connection...');
      // Retries: 10, delay: 1 gives ~10s for user interaction with desktop permission prompts on HTTPS Vercel
      await qz.websocket.connect({ retries: 10, delay: 1, keepAlive: 60 });
      console.log('[QZ Printer] qz.websocket.connect() resolved successfully. Active:', isQZActive());
    } catch (err: any) {
      console.error('[QZ Printer] qz.websocket.connect() failed:', err);
      throw err;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Disconnects from QZ Tray WebSocket.
 */
export async function disconnectQZ(): Promise<void> {
  try {
    if (isQZActive()) {
      console.log('[QZ Printer] Disconnecting QZ Tray WebSocket...');
      await qz.websocket.disconnect();
      console.log('[QZ Printer] QZ Tray WebSocket disconnected.');
    }
  } catch (err) {
    console.warn('[QZ Printer] Error during QZ Tray disconnect:', err);
  }
}

/**
 * Returns list of all installed printers discovered by QZ Tray.
 * Uses existing active connection.
 */
export async function getPrinters(): Promise<string[]> {
  await connectQZ();
  try {
    console.log('[QZ Printer] Querying installed printers via qz.printers.find()...');
    const res = await qz.printers.find();
    console.log('[QZ Printer] Printers found:', res);
    if (Array.isArray(res)) return res;
    if (typeof res === 'string') return [res];
    return [];
  } catch (err) {
    console.error('[QZ Printer] Error discovering printers:', err);
    throw err;
  }
}

/**
 * Finds default system printer or first available thermal printer.
 * Uses existing active connection.
 */
export async function getDefaultPrinter(): Promise<string | null> {
  await connectQZ();
  try {
    console.log('[QZ Printer] Querying default printer via qz.printers.getDefault()...');
    const defaultPrinter = await qz.printers.getDefault();
    console.log('[QZ Printer] Default printer result:', defaultPrinter);
    if (defaultPrinter) return defaultPrinter;
    
    console.log('[QZ Printer] getDefault() returned null/empty. Trying getPrinters() fallback...');
    const allPrinters = await getPrinters();
    return allPrinters.length > 0 ? allPrinters[0] : null;
  } catch (err) {
    console.warn('[QZ Printer] getDefault() threw error, trying getPrinters() fallback:', err);
    try {
      const printers = await getPrinters();
      return printers.length > 0 ? printers[0] : null;
    } catch (fallbackErr) {
      console.error('[QZ Printer] Printer discovery fallback failed:', fallbackErr);
      throw err;
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
 * Single WebSocket session lifecycle:
 * connect -> discover printer -> Job 1 (Customer Bill) -> Job 2 (KOT) -> disconnect.
 */
export async function printReceiptQZ(
  invoice: SaleInvoice,
  selection: 'both' | 'customer' | 'kot' = 'both'
): Promise<QZPrintResult> {
  let customerPrinted = false;
  let kotPrinted = false;

  try {
    // Step 1: Connect WebSocket ONCE
    console.log('[QZ Printer] Step 1: Establishing WebSocket connection...');
    await connectQZ();

    // Step 2: Discover target printer over the active connection
    console.log('[QZ Printer] Step 2: Discovering default thermal printer...');
    const printer = await getDefaultPrinter();
    if (!printer) {
      return {
        success: false,
        customerPrinted: false,
        kotPrinted: false,
        error: 'No default thermal printer found in QZ Tray. Please set a default printer in Windows settings.'
      };
    }
    console.log(`[QZ Printer] Step 2 complete. Target printer: "${printer}"`);

    // Step 3: Send Job 1 (Customer Bill) over active connection
    if (selection === 'customer' || selection === 'both') {
      console.log('[QZ Printer] Step 3: Printing Job 1 (Customer Bill)...');
      const customerHTML = wrapHTMLForQZ(generateCustomerBillHTML(invoice));
      await printHTMLJob(printer, customerHTML);
      customerPrinted = true;
      console.log('[QZ Printer] Step 3 complete. Job 1 printed successfully.');
    }

    // Step 4: Send Job 2 (KOT) over active connection
    if (selection === 'kot' || selection === 'both') {
      console.log('[QZ Printer] Step 4: Printing Job 2 (KOT)...');
      const kotHTML = wrapHTMLForQZ(generateKOTHTML(invoice));
      await printHTMLJob(printer, kotHTML);
      kotPrinted = true;
      console.log('[QZ Printer] Step 4 complete. Job 2 printed successfully.');
    }

    // Step 5: Disconnect ONCE after both jobs finish
    console.log('[QZ Printer] Step 5: Disconnecting QZ Tray WebSocket...');
    await disconnectQZ();

    return {
      success: true,
      customerPrinted,
      kotPrinted
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error('[QZ Printer] Print execution failed:', err);

    // Clean disconnect on error
    try {
      await disconnectQZ();
    } catch {}

    return {
      success: false,
      customerPrinted,
      kotPrinted,
      error: customerPrinted
        ? `Customer Bill printed, but KOT failed: ${errorMsg}`
        : `QZ Print Error: ${errorMsg}`
    };
  }
}
