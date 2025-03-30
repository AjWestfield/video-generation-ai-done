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
      
      const versionId = "b744535cf2bf3c4cf2130d0cc75cd4795b280215f8275b041015fb4f9917cbcd"; // Correct version
      let finalImageUrl: string | null = null;
      let finalBase64Image: string | null = null;

      try {
        // --- Initial Generation Attempt ---
        const prediction = await replicate.predictions.create({
          version: versionId,
          input: {
            prompt: sanitizedPrompt,
            aspect_ratio: "16:9",
            output_format: "png",
            output_quality: 100,
            prompt_upsampling: true,
          },
        });
        const completedPrediction = await replicate.wait(prediction);

        if (completedPrediction.status === "failed" || completedPrediction.status === "canceled") {
          // Convert error object to string before throwing
          const errorMsg = completedPrediction.error ? JSON.stringify(completedPrediction.error) : "Prediction failed or canceled";
          throw new Error(errorMsg);
        }
        finalImageUrl = completedPrediction.output as string;
        if (!finalImageUrl) {
          throw new Error("Prediction succeeded but output URL was missing");
        }
        console.log(`Successfully generated image for timestamp ${timestamp}`);

      } catch (error: any) {
        console.error(`Error generating image for timestamp ${timestamp}:`, error);

        // --- NSFW Fallback Attempt ---
        if (error?.message?.includes("NSFW") || error?.toString().includes("NSFW")) {
          console.log(`Creating alternative image for NSFW content at timestamp ${timestamp}`);
          const alternativePrompt = createAlternativePrompt(sanitizedPrompt);
          try {
            const altPrediction = await replicate.predictions.create({
              version: versionId,
              input: {
                prompt: alternativePrompt,
                aspect_ratio: "16:9",
                output_format: "png",
                output_quality: 100,
                prompt_upsampling: true,
              },
            });
            const completedAltPrediction = await replicate.wait(altPrediction);

            if (completedAltPrediction.status === "failed" || completedAltPrediction.status === "canceled") {
               // Convert error object to string before throwing
               const altErrorMsg = completedAltPrediction.error ? JSON.stringify(completedAltPrediction.error) : "Alternative prediction failed or canceled";
               throw new Error(altErrorMsg);
            }
            finalImageUrl = completedAltPrediction.output as string; // Use alternative URL
            if (!finalImageUrl) {
              console.error("Alternative image generation succeeded but output URL was missing.");
              finalImageUrl = null; // Ensure we don't proceed if URL is missing
            } else {
               console.log(`Successfully generated alternative image for timestamp ${timestamp}`);
            }
          } catch (alternativeError) {
            console.error(`Alternative image generation failed:`, alternativeError);
            finalImageUrl = null; // Ensure we don't proceed if alternative fails
          }
        }
        // If error was not NSFW or alternative failed, finalImageUrl remains null
      }

      // --- Process the final image URL (if one was successfully obtained) ---
      if (finalImageUrl) {
        try {
          const imageResponse = await fetch(finalImageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image URL: ${imageResponse.statusText}`);
          }
          const blob = await imageResponse.blob();
          const arrayBuffer = await blob.arrayBuffer();
          finalBase64Image = `data:${blob.type};base64,${Buffer.from(arrayBuffer).toString('base64')}`;

          results.push({
            timestamp,
            imageUrl: finalImageUrl,
            imageBase64: finalBase64Image,
          });
        } catch (fetchError) {
           console.error(`Error fetching or converting image for timestamp ${timestamp}:`, fetchError);
           // Continue without adding this image if fetching/conversion fails
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
