const SPREADSHEET_ID = "1Wa9VweukM8CIBsirKdO-jyJBudO1icXjjEZk1-nQOj8";
const DATA_SHEET_NAME = "Data";
const DROPDOWN_SHEET_NAME = "dropdown";
const DRIVE_FOLDER_ID = "157w45-NDaGczWvZQCNZiGD8adQ7HtGxC";

// GET: Returns only POs that have NOT yet been used (not in Data tab)
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Get all available POs from dropdown sheet
    const dropSheet = ss.getSheetByName(DROPDOWN_SHEET_NAME);
    let allPOs = [];
    if (dropSheet) {
      const data = dropSheet.getRange("A2:A").getValues();
      allPOs = data.map(row => row[0]).filter(val => val && val.toString().trim() !== "");
    }

    // Get already-used POs from Data sheet (column C = Vendor PO Number)
    const dataSheet = ss.getSheetByName(DATA_SHEET_NAME);
    let usedPOs = new Set();
    if (dataSheet) {
      const lastRow = dataSheet.getLastRow();
      if (lastRow > 1) {
        const usedData = dataSheet.getRange(2, 3, lastRow - 1, 1).getValues();
        usedData.forEach(row => {
          if (row[0] && row[0].toString().trim() !== "") {
            usedPOs.add(row[0].toString().trim());
          }
        });
      }
    }

    // Filter: only show POs not yet used
    const availablePOs = allPOs.filter(po => !usedPOs.has(po.toString().trim()));

    return ContentService.createTextOutput(JSON.stringify({ success: true, vendorPOs: availablePOs }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// POST: Save entry and upload invoice image to Google Drive
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    const entryDate   = payload.entryDate;
    const vendorPO    = payload.vendorPO;
    const invoiceNumber = payload.invoiceNumber;
    const email       = payload.email || "System User";
    const base64Image = payload.base64Image || null;

    let fileUrl = "No Image Captured";

    // Upload invoice image to Google Drive if provided
    if (base64Image && base64Image.length > 100) {
      try {
        const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        const mimeMatch  = base64Image.match(/^data:(image\/[a-z]+);base64,/);
        const mimeType   = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const ext        = mimeType.split('/')[1] || 'jpg';

        const decoded = Utilities.base64Decode(base64Data);
        const blob    = Utilities.newBlob(decoded, mimeType);

        // File name: VendorPO_InvoiceNo_Date.ext
        const safePO  = vendorPO.replace(/[\/\\:*?"<>|]/g, '-');
        const safeInv = invoiceNumber.replace(/[\/\\:*?"<>|]/g, '-');
        const dateStr = entryDate.replace(/-/g, '');
        blob.setName(`${safePO}_${safeInv}_${dateStr}.${ext}`);

        const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
        const file   = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        fileUrl = file.getUrl();
      } catch (uploadErr) {
        console.error("Drive upload failed:", uploadErr.message);
        fileUrl = "Upload Error: " + uploadErr.message;
      }
    }

    const sheet     = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DATA_SHEET_NAME);
    const timestamp = new Date();

    sheet.appendRow([timestamp, entryDate, vendorPO, invoiceNumber, fileUrl, email]);
    SpreadsheetApp.flush();

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Gate entry recorded!" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error("doPost error:", err.message);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Error: " + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
