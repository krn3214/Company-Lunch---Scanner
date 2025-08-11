
/*
  script.js (Final Fixed Version)
  - Works with your current index.html/style.css
  - Explicit camera permission request
  - Fallback from back to front camera if needed
  - Auto-stop after first successful scan
  - Sends data to your Google Apps Script Web App
*/

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyE6dL8w2jXiK4A-ptau5RGr3dhaypyXZ-r-4yhcc4ucprEkXEFgFfP78v-30R1VliCBw/exec";
const SHEET_VIEW_LINK = "https://docs.google.com/spreadsheets/d/1kLOneIDrlc-GrX5yZuXfsJCw614QZkzEcZocUC5ne2Y/edit?gid=0#gid=0";

const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const resultDiv = document.getElementById('result');
const lastScanDiv = document.getElementById('last-scan');
const readerId = "reader";
const sheetLinkEl = document.getElementById('sheet-link');

if (SHEET_VIEW_LINK && sheetLinkEl) sheetLinkEl.href = SHEET_VIEW_LINK;

let html5QrCode = null;
let isScanning = false;

// Parse QR payload into structured data
function parsePayload(text) {
    const obj = { empId: '', name: '', department: '' };
    if (!text) return obj;

    if (text.indexOf(',') > -1 && text.indexOf(':') === -1) {
        const parts = text.split(',').map(p => p.trim());
        obj.empId = parts[0] || '';
        obj.name = parts[1] || '';
        obj.department = parts[2] || '';
        return obj;
    }

    const pairs = text.split(',').map(p => p.trim());
    pairs.forEach(p => {
        const [k, v] = p.split(':').map(x => x && x.trim());
        if (!k) return;
        const key = k.toLowerCase();
        if (key.includes('emp') || key.includes('id')) obj.empId = v || obj.empId;
        if (key.includes('name')) obj.name = v || obj.name;
        if (key.includes('dept')) obj.department = v || obj.department;
    });
    return obj;
}

// Start scanning
startBtn.addEventListener('click', async () => {
    if (isScanning) return;
    isScanning = true;
    resultDiv.textContent = "Requesting camera access...";

    // Request permission first
    try {
        await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
        resultDiv.textContent = "Camera access denied or unavailable.";
        isScanning = false;
        return;
    }

    html5QrCode = new Html5Qrcode(readerId);

    // Try starting with back camera, then fallback to front
    try {
        await html5QrCode.start(
            { facingMode: { exact: "environment" } },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            qrSuccess
        );
    } catch (err1) {
        try {
            await html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                qrSuccess
            );
        } catch (err2) {
            try {
                await html5QrCode.start(
                    { facingMode: "user" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    qrSuccess
                );
            } catch (err3) {
                console.error("Camera start error:", err3);
                resultDiv.textContent = "Unable to start camera. Try another device or browser.";
                isScanning = false;
            }
        }
    }
});

// Reset scanning state
resetBtn.addEventListener('click', async () => {
    resultDiv.textContent = "Reset. Press Start Scan to begin.";
    lastScanDiv.textContent = "No scans yet.";
    if (html5QrCode && isScanning) {
        try { await html5QrCode.stop(); } catch (e) { }
    }
    isScanning = false;
});

// On successful scan
async function qrSuccess(decodedText) {
    if (html5QrCode && isScanning) {
        try { await html5QrCode.stop(); } catch (e) { console.warn("Stop error", e); }
        isScanning = false;
    }

    resultDiv.textContent = "Processing scan...";
    const data = parsePayload(decodedText);

    const payload = {
        empId: data.empId || '',
        name: data.name || '',
        department: data.department || '',
        raw: decodedText || '',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString()
    };

    try {
        const resp = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let jsonResp = null;
        try { jsonResp = await resp.json(); } catch (e) { }
        const statusText = (jsonResp && jsonResp.status) ? jsonResp.status : 'Saved';

        resultDiv.innerHTML = `<strong>${statusText}</strong><br>${payload.empId} — ${payload.name} — ${payload.department}`;
        lastScanDiv.innerHTML = `<div><strong>${payload.empId}</strong> ${payload.name}<br>${payload.department}<br>📅 ${payload.date} ⏰ ${payload.time}</div>`;
    } catch (err) {
        console.error("Send error", err);
        resultDiv.textContent = "Network error while saving.";
        lastScanDiv.textContent = `${payload.empId} ${payload.name} ${payload.department} (offline)`;
    }
}
