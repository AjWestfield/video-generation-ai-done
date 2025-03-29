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
      
      // Clean up prompt - make sure we don't add redundant parameters
      // The prompt might already include 16:9 aspect ratio from the generate-timed-image-prompts API
      const cleanedPrompt = prompt.trim();
      
      // Sanitize the prompt to avoid NSFW filter issues
      const sanitizedPrompt = sanitizePromptForNSFW(cleanedPrompt);
      
      console.log(`Generating image for timestamp ${timestamp} with prompt: ${sanitizedPrompt.substring(0, 100)}...`);
      
      try {
        const output = await replicate.run(
          process.env.REPLICATE_IMAGE_MODEL_ID || "black-forest-labs/flux-schnell",
          {
            input: {
              prompt: sanitizedPrompt,
              aspect_ratio: "16:9",
              output_format: "png",
              output_quality: 100,
              go_fast: true,
              megapixels: "1",
              num_outputs: 1,
              num_inference_steps: 4, // Maximum allowed value for this model
              negative_prompt: "blurry, low quality, cartoon, 3d, painting, drawing, low resolution, square format, portrait orientation, vertical, vertical format, vertical orientation, text, watermark, signature, label, words, characters, nudity, naked, nude, nsfw content",
            },
          }
        );
        
        // Get the image as base64 for easier handling
        const imageUrl = Array.isArray(output) && output.length > 0 ? output[0] : null;
        
        if (imageUrl) {
          const imageResponse = await fetch(imageUrl);
          const blob = await imageResponse.blob();
          
          // Convert to base64
          const arrayBuffer = await blob.arrayBuffer();
          const base64Image = Buffer.from(arrayBuffer).toString('base64');
          
          results.push({
            timestamp,
            imageUrl,
            imageBase64: `data:image/png;base64,${base64Image}`
          });
          
          console.log(`Successfully generated image for timestamp ${timestamp}`);
        } else {
          throw new Error(`Failed to generate image for prompt at timestamp ${timestamp}`);
        }
      } catch (error) {
        console.error(`Error generating image for timestamp ${timestamp}:`, error);
        
        // Create a fallback image for NSFW content errors
        if (error.message?.includes("NSFW")) {
          console.log(`Creating alternative image for NSFW content at timestamp ${timestamp}`);
          
          // Generate a modified prompt that will avoid NSFW filters
          const alternativePrompt = createAlternativePrompt(sanitizedPrompt);
          
          try {
            // Try again with the alternative prompt
            const alternativeOutput = await replicate.run(
              process.env.REPLICATE_IMAGE_MODEL_ID || "black-forest-labs/flux-schnell",
              {
                input: {
                  prompt: alternativePrompt,
                  aspect_ratio: "16:9",
                  output_format: "png",
                  output_quality: 100,
                  go_fast: true,
                  megapixels: "1",
                  num_outputs: 1,
                  num_inference_steps: 4,
                  negative_prompt: "blurry, low quality, cartoon, 3d, painting, drawing, low resolution, square format, portrait orientation, vertical, vertical format, vertical orientation, text, watermark, signature, label, words, characters, nudity, naked, nude, nsfw content",
                },
              }
            );
            
            const alternativeImageUrl = Array.isArray(alternativeOutput) && alternativeOutput.length > 0 ? alternativeOutput[0] : null;
            
            if (alternativeImageUrl) {
              const imageResponse = await fetch(alternativeImageUrl);
              const blob = await imageResponse.blob();
              
              // Convert to base64
              const arrayBuffer = await blob.arrayBuffer();
              const base64Image = Buffer.from(arrayBuffer).toString('base64');
              
              results.push({
                timestamp,
                imageUrl: alternativeImageUrl,
                imageBase64: `data:image/png;base64,${base64Image}`
              });
              
              console.log(`Successfully generated alternative image for timestamp ${timestamp}`);
            } else {
              throw new Error("Alternative image generation failed");
            }
          } catch (alternativeError) {
            console.error(`Alternative image generation failed:`, alternativeError);
            // If all else fails, continue without this image
          }
        }
      }
      
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error("Error from Replicate API:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// Function to sanitize prompts to avoid NSFW detection
function sanitizePromptForNSFW(prompt: string): string {
  // Replace words that might trigger NSFW filters
  return prompt
    .replace(/\bnaked\b/gi, "clothed")
    .replace(/\bnudity\b/gi, "modesty")
    .replace(/\bshame\b/gi, "regret")
    .replace(/\bnakedness\b/gi, "vulnerability")
    .replace(/naked bodies/gi, "figures covered in translucent light")
    .replace(/naked/gi, "draped in light")
    .replace(/nude/gi, "clothed in simple garments");
}

// Function to create alternative prompts for failed NSFW cases
function createAlternativePrompt(originalPrompt: string): string {
  // Create a more abstract/symbolic alternative that avoids NSFW issues
  if (originalPrompt.toLowerCase().includes("adam and eve")) {
    return "photo realistic A man and woman in a garden paradise, dressed in simple cloth garments. Golden light filters through lush trees, creating a serene atmosphere. The scene is captured with cinematic lighting and rich details. 16:9 aspect ratio, landscape orientation";
  }
  
  if (originalPrompt.toLowerCase().includes("birth")) {
    return "photo realistic A family in a moment of deep emotion and transformation. Soft light illuminates their expressions of joy mixed with pain. A profound moment of human experience depicted with dignity and emotional depth. 16:9 aspect ratio, landscape orientation";
  }
  
  // Generic alternative that preserves the theme but removes potential NSFW content
  return "photo realistic A symbolic scene representing human experience in a lush garden setting. Figures draped in flowing white garments exist in harmony with nature. Golden hour lighting creates a mystical atmosphere with dramatic shadows. 16:9 aspect ratio, landscape orientation";
} 