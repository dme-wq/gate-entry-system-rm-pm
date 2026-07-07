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

    // Use Gemini 2.5 Flash with thinking DISABLED for fast, direct extraction
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Look at this invoice image. Find the Invoice Number (labeled as Invoice No., Bill No., Tax Invoice No., Receipt No., or Challan No.).

Return ONLY the invoice number value exactly as printed. No extra words, no labels.
Example valid responses: "351/26-27" or "INV/2024/001" or "12345"
If not found, return: NOT_FOUND`;

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
          temperature: 0.0,
          maxOutputTokens: 100,
          // Disable thinking mode - not needed for simple extraction, avoids token cutoff
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || 'Gemini API error';
      throw new Error(errMsg);
    }

    // For gemini-2.5-flash, find the non-thinking text part in response
    // Thinking parts have "thought: true", actual answer parts don't
    let invoiceNumber = '';
    const parts = data?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (!part.thought && part.text) {
        invoiceNumber = part.text.trim();
        break;
      }
    }

    // Fallback: just take first part if no non-thought part found
    if (!invoiceNumber) {
      invoiceNumber = parts[0]?.text?.trim() || '';
    }

    // Clean up: remove any leading label like "Invoice number:" if Gemini adds it
    invoiceNumber = invoiceNumber
      .replace(/^(invoice\s*(no\.?|number|#)?[\s:\-]*)/i, '')
      .trim();

    const notFound = invoiceNumber === '' || invoiceNumber.toUpperCase() === 'NOT_FOUND';

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
