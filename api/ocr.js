export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const base64Image = body.base64Image;

    if (!base64Image) {
      return new Response(JSON.stringify({ error: 'Missing base64 image' }), { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server missing API key (GEMINI_API_KEY is not set)' }), { status: 500 });
    }

    // Strip the data URI prefix to get clean base64
    const base64Content = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    // Determine MIME type from original data URI
    const mimeMatch = base64Image.match(/^data:(image\/[a-z]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    // Use Gemini 1.5 Flash (FREE tier) with vision to extract Invoice Number directly
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `You are an expert invoice data extractor. Look at this invoice image carefully.

Your ONLY task: Find and return the Invoice Number (also called Invoice No, Bill No, Tax Invoice No, Receipt No, Challan No, or similar).

Rules:
- Return ONLY the invoice number value, nothing else
- No labels, no explanation, no extra words
- Keep the exact format as shown in the invoice (e.g., "INV/2024/001" or "12345" or "GST/789/24-25")
- If you cannot find any invoice number, return exactly: NOT_FOUND

Invoice number:`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Content
              }
            },
            {
              text: prompt
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,       // Low temperature = more accurate, less creative
          maxOutputTokens: 50,    // Invoice number is short, no need for more
          topP: 0.8,
          topK: 10
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || 'Gemini API error';
      throw new Error(errMsg);
    }

    // Extract the text from Gemini's response
    const invoiceNumber = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // Return both the extracted invoice number AND a flag if not found
    const notFound = invoiceNumber === 'NOT_FOUND' || invoiceNumber === '';

    return new Response(JSON.stringify({
      invoiceNumber: notFound ? '' : invoiceNumber,
      found: !notFound
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Gemini OCR Error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
