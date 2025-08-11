
# Lunch QR Scanner - GitHub Pages Package

This package contains a mobile-friendly QR scanner web app that logs lunch attendance to a Google Sheet via Google Apps Script.

## Files in this package
- `index.html` - Main web page (ready for GitHub Pages)
- `style.css` - Styling for mobile-friendly UI
- `script.js` - Scanner logic + POST to Apps Script
- `logo-placeholder.png` - Placeholder image for company logo
- `README.md` - This file with setup instructions and Apps Script code

## Google Sheet structure
Create a Google Sheet with two sheets (tabs):

1) **EmployeeData** (used for validation)
| Emp ID | Employee Name | Department |
|--------|---------------|------------|
| E001   | Amit Sharma   | IT         |

2) **LunchRecords** (records appended by Apps Script)
| Emp ID | Employee Name | Department | Date       | Time     | Status |
|--------|---------------|------------|------------|----------|--------|

## Google Apps Script (paste into Extensions → Apps Script)
Use this script (replace sheet names if different):

```javascript
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var employeeSheet = ss.getSheetByName('EmployeeData');
    var recordSheet = ss.getSheetByName('LunchRecords');
    var data = JSON.parse(e.postData.contents);

    var empId = (data.empId || '').toString().trim();
    var name = (data.name || '').toString().trim();
    var dept = (data.department || '').toString().trim();

    var timezone = Session.getScriptTimeZone() || 'Asia/Kolkata';
    var now = new Date();
    var dateStr = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
    var timeStr = Utilities.formatDate(now, timezone, 'HH:mm:ss');

    // Validate employee
    var empValues = employeeSheet.getDataRange().getValues(); // includes header
    // find row (skip header)
    var found = null;
    for (var i = 1; i < empValues.length; i++) {
      var row = empValues[i];
      if (row[0].toString().trim() == empId || row[1].toString().trim() == name) {
        found = { empId: row[0].toString(), name: row[1].toString(), dept: row[2].toString() };
        break;
      }
    }

    var status = '';
    if (!found) {
      status = 'Employee not found';
      // still append so audit trail exists
      recordSheet.appendRow([empId, name, dept, dateStr, timeStr, status]);
      return ContentService.createTextOutput(JSON.stringify({ status: status })).setMimeType(ContentService.MimeType.JSON);
    }

    // Check if already served today
    var recValues = recordSheet.getDataRange().getValues();
    var already = false;
    for (var j = 1; j < recValues.length; j++) {
      var r = recValues[j];
      if (r[0].toString().trim() == found.empId && r[3].toString().trim() == dateStr && r[5].toString().indexOf('Lunch Recorded') !== -1) {
        already = true;
        break;
      }
    }

    if (already) {
      status = 'Already served today';
      recordSheet.appendRow([found.empId, found.name, found.dept, dateStr, timeStr, status]);
      return ContentService.createTextOutput(JSON.stringify({ status: status })).setMimeType(ContentService.MimeType.JSON);
    }

    // Record lunch
    status = 'Lunch Recorded';
    recordSheet.appendRow([found.empId, found.name, found.dept, dateStr, timeStr, status]);

    return ContentService.createTextOutput(JSON.stringify({ status: status })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Deploy as Web App
1. In Apps Script: Deploy → New deployment → Web app.
2. Execute as: **Me**. Who has access: **Anyone**.
3. Click Deploy → copy the Web App URL.
4. Paste the URL into `script.js` (replace `YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL`).
5. Also paste the Google Sheet view link into `script.js` for the "View Sheet" button.

## Notes & Testing
- Host these files on GitHub Pages (HTTPS) for camera permission to work on mobile browsers.
- QR formats supported:
  - `EmpId: E001, Name: Amit Sharma, Department: IT`
  - `E001,Amit Sharma,IT`
- The scanner **auto-stops** after reading one QR and sends data to the Apps Script.
