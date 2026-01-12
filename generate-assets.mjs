// generate-assets.mjs
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const stories = [
  { chapter: 1, prompt: "A friendly green monster named Knurzel jumping in a puddle." },
  { chapter: 2, prompt: "Knurzel sleeping in a cozy bed with a teddy bear." }
];

async function main() {
  // Ensure public/assets folder exists
  const assetsDir = path.join(process.cwd(), "public", "assets");
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const outputData = [];

  for (const story of stories) {
    console.log(`Generating Chapter ${story.chapter}...`);

    // 1. Text Generation (GPT-4)
    const textRes = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: `Write a short 4-line rhyming German poem about: ${story.prompt}` }]
    });
    const text = textRes.choices[0].message.content;

    // 2. Image Generation (DALL-E 3)
    const imgRes = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Illustration for children's book: ${story.prompt}. 3D render style.`,
      size: "1024x1024",
      response_format: "b64_json" // We get base64 to save as file
    });
    
    // Save Image
    const imgFilename = `chapter-${story.chapter}.png`;
    fs.writeFileSync(
      path.join(assetsDir, imgFilename), 
      Buffer.from(imgRes.data[0].b64_json, 'base64')
    );

    // 3. Audio Generation (TTS)
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });
    const audioFilename = `chapter-${story.chapter}.mp3`;
    const buffer = Buffer.from(await mp3.arrayBuffer());
    fs.writeFileSync(path.join(assetsDir, audioFilename), buffer);

    outputData.push({
      chapter: story.chapter,
      text: text,
      imagePath: `/assets/${imgFilename}`,
      audioPath: `/assets/${audioFilename}`
    });
  }

  // Save a JSON manifest to read in the frontend
  fs.writeFileSync(
    path.join(process.cwd(), "public", "story-data.json"), 
    JSON.stringify(outputData, null, 2)
  );

  console.log("Done! Assets saved to /public/assets and data to story-data.json");
}

main();