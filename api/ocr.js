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

    const apiKey = process.env.VISION_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server missing API key (VISION_API_KEY is not set)' }), { status: 500 });
    }

    // Google Cloud Vision API expects base64 without the data URI prefix
    const base64Content = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ 
          image: { content: base64Content }, 
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] 
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Vision API returned an error');
    }

    const text = data.responses[0]?.fullTextAnnotation?.text || '';
    
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error("Cloud Vision Error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
