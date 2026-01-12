import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { put } from '@vercel/blob';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const stichpunkte = formData.get('stichpunkte') as string;

    if (!file || !stichpunkte) {
      return NextResponse.json({ error: "File and text required" }, { status: 400 });
    }

    // --- STEP 1: Handle Image Analysis ---
    // Since we don't have Blob yet, we can't easily pass the image to GPT-4 Vision via URL.
    // FOR TESTING ONLY: We will skip the specific image analysis and just use the user's text.
    // (Once you set up Blob, uncomment the original logic)
    const characterDescription = "A friendly green monster (Generic description for testing)";

    // --- STEP 2: Generate Text ---
    const textResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: `Write a short German poem based on: ${stichpunkte}. Character: ${characterDescription}` }],
    });
    const poem = textResponse.choices[0].message.content;

    // --- STEP 3: Generate Image ---
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: `A 3D render of ${characterDescription}. Context: ${stichpunkte}`,
      n: 1,
      size: "1024x1024",
    });

    // FIX TYPESCRIPT ERROR HERE: Use ?. to access data safely
    let imageUrl = imageResponse.data?.[0]?.url; 
    
    if (!imageUrl) throw new Error("No image generated");

    // --- STEP 4: Vercel Blob (Conditional) ---
    // If we have the token, we save it. If not, we just return the OpenAI URL (Temporary)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
       try {
         const imageFetch = await fetch(imageUrl);
         const imageBuffer = await imageFetch.blob();
         const blob = await put(`generated-${Date.now()}.png`, imageBuffer, { access: 'public' });
         imageUrl = blob.url; // Overwrite with permanent Blob URL
       } catch (e) {
         console.warn("Blob upload failed, falling back to OpenAI URL", e);
       }
    }

    return NextResponse.json({
      text: poem,
      imageUrl: imageUrl // Returns either the Blob URL or the temporary OpenAI URL
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}