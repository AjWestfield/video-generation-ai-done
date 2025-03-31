import { NextResponse } from "next/server";
import Replicate from "replicate";
import { Buffer } from 'buffer'; // Import Buffer for base64 conversion

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      "The REPLICATE_API_TOKEN environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { prompt: originalPrompt } = await request.json();

  if (!originalPrompt || typeof originalPrompt !== 'string') {
     return NextResponse.json({ error: "Invalid prompt provided" }, { status: 400 });
  }

  const versionId = "b744535cf2bf3c4cf2130d0cc75cd4795b280215f8275b041015fb4f9917cbcd";
  let finalImageUrl: string | null = null;
  let finalBase64Image: string | null = null;
  let errorMessage: string | null = null;

  // Sanitize the prompt first
  const sanitizedPrompt = sanitizePromptForNSFW(originalPrompt.trim());
  console.log(`Generating image with prompt: ${sanitizedPrompt.substring(0, 100)}...`);

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
        // Add negative prompts to steer away from non-realistic styles
        negative_prompt: "cartoon, animation, drawing, sketch, illustration, anime, manga, unrealistic, low quality, blurry, text, words, letters, signature, watermark",
      },
    });
    const completedPrediction = await replicate.wait(prediction);

    if (completedPrediction.status === "failed" || completedPrediction.status === "canceled") {
      const errorMsg = completedPrediction.error ? JSON.stringify(completedPrediction.error) : "Prediction failed or canceled";
      throw new Error(errorMsg); // Throw to trigger catch block
    }
    finalImageUrl = completedPrediction.output as string;
    if (!finalImageUrl) {
      throw new Error("Prediction succeeded but output URL was missing");
    }
    console.log(`Successfully generated image.`);

  } catch (error: any) {
    console.error(`Error generating image:`, error);
    errorMessage = (error as Error).message; // Store original error message

    // --- NSFW Fallback Attempt ---
    // Check error message string for NSFW indicators
    if (errorMessage?.toLowerCase().includes("nsfw")) {
      console.log(`NSFW detected. Creating alternative image...`);
      const alternativePrompt = createAlternativePrompt(sanitizedPrompt);
      errorMessage = null; // Clear previous error message before retry
      try {
        const altPrediction = await replicate.predictions.create({
          version: versionId,
          input: {
            prompt: alternativePrompt,
            aspect_ratio: "16:9",
            output_format: "png",
            output_quality: 100,
            prompt_upsampling: true,
            // Add negative prompts to the fallback as well
            negative_prompt: "cartoon, animation, drawing, sketch, illustration, anime, manga, unrealistic, low quality, blurry, text, words, letters, signature, watermark",
          },
        });
        const completedAltPrediction = await replicate.wait(altPrediction);

        if (completedAltPrediction.status === "failed" || completedAltPrediction.status === "canceled") {
           const altErrorMsg = completedAltPrediction.error ? JSON.stringify(completedAltPrediction.error) : "Alternative prediction failed or canceled";
           throw new Error(altErrorMsg); // Throw alternative error
        }
        finalImageUrl = completedAltPrediction.output as string; // Use alternative URL
        if (!finalImageUrl) {
          console.error("Alternative image generation succeeded but output URL was missing.");
          finalImageUrl = null;
          errorMessage = "Alternative image generation succeeded but output URL was missing.";
        } else {
           console.log(`Successfully generated alternative image.`);
        }
      } catch (alternativeError) {
        console.error(`Alternative image generation failed:`, alternativeError);
        finalImageUrl = null; // Ensure we don't proceed if alternative fails
        errorMessage = (alternativeError as Error).message; // Store alternative error message
      }
    }
    // If error was not NSFW or alternative failed, finalImageUrl remains null and errorMessage holds the relevant error
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
    } catch (fetchError) {
       console.error(`Error fetching or converting image:`, fetchError);
       errorMessage = (fetchError as Error).message; // Store fetch error
       finalBase64Image = null; // Ensure we return error if fetch fails
    }
  }

  // --- Return Response ---
  if (finalBase64Image) {
    // Success: Return the base64 image
    return NextResponse.json({ imageBase64: finalBase64Image }, { status: 200 });
  } else {
    // Failure: Return the relevant error message
    // Include NSFW in the error message if that was the original cause
    const finalErrorMessage = errorMessage?.toLowerCase().includes("nsfw")
        ? `NSFW content detected and fallback failed: ${errorMessage}`
        : errorMessage || "Unknown error during image generation";

    // Return a specific error structure that the frontend can check
    return NextResponse.json({ error: finalErrorMessage, isNsfwError: errorMessage?.toLowerCase().includes("nsfw") }, { status: 500 });
  }
}


// --- Helper Functions (copied from batch API) ---

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
