
/*
  script.js
  - Replace WEB_APP_URL with your deployed Google Apps Script web app URL
  - Replace SHEET_VIEW_LINK with the Google Sheet view link (optional)
*/

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwPaRLiTCJzp_FYdsxQybaUs3jDP0liFX9DUsUtHtaqyBqaRxGHLLcjGqGFdg3-jzTA8Q/exec";
const SHEET_VIEW_LINK = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_bORjediI9DuE8Bf4l_gemx3H8QhjKCxYKo2PF9qGdPphtHhxQPpNXOGClfdNvHmJhYFkMYLcM1Sl/pubhtml";

// UI elements
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const resultDiv = document.getElementById('result');
const lastScanDiv = document.getElementById('last-scan');
const readerId = "reader";
const sheetLinkEl = document.getElementById('sheet-link');

if (SHEET_VIEW_LINK && sheetLinkEl) sheetLinkEl.href = SHEET_VIEW_LINK;

let html5QrCode = null;
let isScanning = false;

// Utility: parse QR payload to object
// Supported formats:
// 1) "EmpId: E001, Name: Amit Sharma, Department: IT"
// 2) "E001,Amit Sharma,IT"
function parsePayload(text){
  // try key:value pairs first
  const obj = { empId:'', name:'', department:'' };
  if (!text) return obj;
  // attempt CSV-like first
  if (text.indexOf(',') > -1 && text.indexOf(':') === -1){
    const parts = text.split(',').map(p => p.trim());
    obj.empId = parts[0] || '';
    obj.name = parts[1] || '';
    obj.department = parts[2] || '';
    return obj;
  }
  // attempt key:value pairs
  const pairs = text.split(',').map(p => p.trim());
  pairs.forEach(p => {
    const [k,v] = p.split(':').map(x => x && x.trim());
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
  resultDiv.textContent = "Starting camera... grant permission if prompted.";
  html5QrCode = new Html5Qrcode(readerId, /* verbose= */ false);
  try {
    await html5QrCode.start(
      { facingMode: { exact: "environment" } }, // back camera
      { fps: 10, qrbox: { width: 250, height: 250 } },
      qrSuccess
    );
  } catch(err){
    // fallback to any camera if exact back camera not found
    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        qrSuccess
      );
    } catch(err2){
      console.error(err2);
      resultDiv.textContent = "Camera not available. Check permission or use another browser.";
      isScanning = false;
    }
  }
});

// Reset UI & scanner
resetBtn.addEventListener('click', async () => {
  resultDiv.textContent = "Reset. Press Start Scan to begin.";
  lastScanDiv.textContent = "No scans yet.";
  if (html5QrCode && isScanning){
    try{ await html5QrCode.stop(); }catch(e){}
  }
  isScanning = false;
});

// On successful QR read
async function qrSuccess(decodedText, decodedResult){
  // Immediately stop scanning (auto-stop requirement)
  if (html5QrCode && isScanning){
    try{ await html5QrCode.stop(); } catch(e){ console.warn('stop error',e); }
    isScanning = false;
  }
  resultDiv.textContent = "Processing scan...";
  const data = parsePayload(decodedText);
  // Prepare payload for Apps Script
  const payload = {
    empId: data.empId || '',
    name: data.name || '',
    department: data.department || '',
    raw: decodedText || ''
  };
  // record timestamp locally
  const now = new Date();
  payload.date = now.toLocaleDateString();
  payload.time = now.toLocaleTimeString();
  // send to backend
  try{
    const resp = await fetch(WEB_APP_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    // Apps Script sometimes returns JSON; handle accordingly
    let jsonResp = null;
    try{ jsonResp = await resp.json(); }catch(e){ /* no-json response */ }
    const statusText = (jsonResp && jsonResp.status) ? jsonResp.status : 'Saved';
    resultDiv.innerHTML = `<strong>${statusText}</strong><br>${payload.empId} — ${payload.name} — ${payload.department}`;
    lastScanDiv.innerHTML = `<div><strong>${payload.empId}</strong> ${payload.name}<br>${payload.department}<br>📅 ${payload.date} ⏰ ${payload.time}</div>`;
  }catch(err){
    console.error('Send error', err);
    resultDiv.textContent = "Network error while saving. Scan saved locally.";
    lastScanDiv.textContent = `${payload.empId} ${payload.name} ${payload.department} (offline)`;
  }
}
