const SPREADSHEET_ID = "1Wa9VweukM8CIBsirKdO-jyJBudO1icXjjEZk1-nQOj8";
const DATA_SHEET_NAME = "Data";
const DROPDOWN_SHEET_NAME = "dropdown";
const DRIVE_FOLDER_ID = "157w45-NDaGczWvZQCNZiGD8adQ7HtGxC"; // Invoice upload folder

// This function responds to GET requests and returns the valid Vendor PO list
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DROPDOWN_SHEET_NAME);
    let vendorPOs = [];
    if (sheet) {
      const data = sheet.getRange("A2:A").getValues();
      vendorPOs = data.map(row => row[0]).filter(val => val && val.toString().trim() !== "");
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, vendorPOs: vendorPOs }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// This handles the form submission from Vercel
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    
    const entryDate = payload.entryDate;
    const vendorPO = payload.vendorPO;
    const invoiceNumber = payload.invoiceNumber;
    const email = payload.email || "System User";
    const base64Image = payload.base64Image || null; // Invoice image from camera

    let fileUrl = "";

    // Upload invoice image to Google Drive if provided
    if (base64Image) {
      try {
        // Decode base64 image
        const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        const mimeMatch = base64Image.match(/^data:(image\/[a-z]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpg';

        const decoded = Utilities.base64Decode(base64Data);
        const blob = Utilities.newBlob(decoded, mimeType);

        // File name: VendorPO_InvoiceNo_Date.ext
        const safePO = vendorPO.replace(/[\/\\:*?"<>|]/g, '-');
        const safeInv = invoiceNumber.replace(/[\/\\:*?"<>|]/g, '-');
        const dateStr = entryDate.replace(/-/g, '');
        blob.setName(`${safePO}_${safeInv}_${dateStr}.${ext}`);

        // Upload to the designated Google Drive folder
        const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        fileUrl = file.getUrl();
      } catch (uploadErr) {
        console.error("Drive upload failed:", uploadErr);
        fileUrl = "Upload Failed";
      }
    } else {
      fileUrl = "No Image";
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DATA_SHEET_NAME);
    const timestamp = new Date();

    // Format: Timestamp | Date | Vendor PO Number | Invoice Number | Invoice/Challan Upload | Email ID
    sheet.appendRow([timestamp, entryDate, vendorPO, invoiceNumber, fileUrl, email]);
    
    SpreadsheetApp.flush();
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Gate entry recorded successfully!" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    console.error("Error in doPost: ", err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Error saving data: " + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
