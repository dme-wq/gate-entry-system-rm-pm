const SPREADSHEET_ID = "1Wa9VweukM8CIBsirKdO-jyJBudO1icXjjEZk1-nQOj8";
const DATA_SHEET_NAME = "Data";

const DROPDOWN_SHEET_NAME = "dropdown";

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
    // We expect the Vercel frontend to send JSON via text/plain to avoid CORS preflight errors
    const payload = JSON.parse(e.postData.contents);
    
    const entryDate = payload.entryDate;
    const vendorPO = payload.vendorPO;
    const invoiceNumber = payload.invoiceNumber;
    const email = payload.email || "Unknown User";
    
    const fileUrlsStr = "OCR Extracted"; // No files uploaded in this Vercel version
    
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DATA_SHEET_NAME);
    const timestamp = new Date(); // Use generic timestamp for Col A
    
    // Format: Timestamp | Date | Vendor PO Number | Invoice Number | Invoice/Challan Upload | Email ID
    sheet.appendRow([timestamp, entryDate, vendorPO, invoiceNumber, fileUrlsStr, email]);
    
    // Force write buffer synchronization
    SpreadsheetApp.flush();
    
    // Return Success
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Gate entry recorded successfully!" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    console.error("Error in doPost: ", err);
    // Return Error
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Error saving data: " + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
