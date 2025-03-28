import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      "The REPLICATE_API_TOKEN environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { prompts } = await request.json();

  if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
    return NextResponse.json({ error: "Invalid prompts array" }, { status: 400 });
  }

  try {
    // Process each prompt sequentially to avoid rate limiting
    const results = [];
    for (const promptData of prompts) {
      const { timestamp, prompt } = promptData;
      
      // Use the exact 16:9 aspect ratio with high resolution
      // Note: The model may have its own constraints on max resolution
      const output = await replicate.run(
        process.env.REPLICATE_IMAGE_MODEL_ID || "black-forest-labs/flux-schnell",
        {
          input: {
            prompt: `${prompt}`,
            width: 1024, // Lower resolution to ensure model compatibility
            height: 576, // Perfect 16:9 aspect ratio (1024:576)
            num_outputs: 1,
            num_inference_steps: 4,
            guidance_scale: 7.5,
            negative_prompt: "blurry, low quality, cartoon, 3d, painting, drawing, low resolution, distorted proportions, stretched, warped, deformed, pixelated, unnatural aspect ratio",
          },
        }
      );
      
      // Get the image as base64 for easier handling
      const imageUrl = Array.isArray(output) && output.length > 0 ? output[0] : null;
      
      if (imageUrl) {
        // Fetch the image and convert to base64
        const imageResponse = await fetch(imageUrl);
        const blob = await imageResponse.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString('base64');
        
        results.push({
          timestamp,
          imageBase64: `data:image/jpeg;base64,${base64Image}`
        });
      }
    }
    
    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error("Error generating timed images:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
} 