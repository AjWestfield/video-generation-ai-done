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

  // Destructure both prompt and negativePrompt from the request body
  const { prompt: originalPrompt, negativePrompt: providedNegativePrompt } = await request.json();

  if (!originalPrompt || typeof originalPrompt !== 'string') {
     return NextResponse.json({ error: "Invalid prompt provided" }, { status: 400 });
  }
  // Validate negativePrompt is a string if provided
  if (providedNegativePrompt && typeof providedNegativePrompt !== 'string') {
     console.warn("Received invalid negativePrompt type, using default.");
     // Fallback handled below
  }

  // Define default negative prompt
  const defaultNegativePrompt = "cartoon, animation, drawing, sketch, illustration, anime, manga, unrealistic, low quality, blurry, text, words, letters, signature, watermark";
  // Use provided negative prompt or default
  const negativePromptToUse = (providedNegativePrompt && typeof providedNegativePrompt === 'string') ? providedNegativePrompt : defaultNegativePrompt;
  // Removed extra closing brace here

  const versionId = "b744535cf2bf3c4cf2130d0cc75cd4795b280215f8275b041015fb4f9917cbcd";
  let finalImageUrl: string | null = null;
  let finalBase64Image: string | null = null;
  let errorMessage: string | null = null;
  let isFinalErrorNsfw = false; // Track if the *final* error after retries is NSFW

  // --- NSFW Auto-Retry Configuration ---
  const MAX_RETRIES = 3;
  const NSFW_THRESHOLD = 0.85; // Adjust as needed
  const RETRY_STRATEGY = [
    "mild nudity, suggestive content",
    "explicit content, sexual themes, violence",
    "adult content, graphic elements, gore",
  ];
  // --- End Configuration ---

  let retryCount = 0;
  let currentPrompt = originalPrompt.trim(); // Start with the original prompt
  let currentNegativePrompt = negativePromptToUse; // Start with provided or default negative

  while (retryCount <= MAX_RETRIES) {
    errorMessage = null; // Clear error for this attempt
    isFinalErrorNsfw = false; // Reset NSFW flag for this attempt
    let attemptFailed = false;
    let predictionResult: any = null; // Use 'any' for flexibility with Replicate response structure

    // --- Prepare prompts for this attempt ---
    let promptForApi = currentPrompt;
    let negativeForApi = currentNegativePrompt;

    if (retryCount > 0) {
        console.log(`--- NSFW Retry Attempt ${retryCount}/${MAX_RETRIES} ---`);
        // 1. Apply Safety Modifications (Simple Example)
        promptForApi = applySafetyModifiers(promptForApi);
        // 2. Apply Contextual Negatives
        negativeForApi = applyContextualNegatives(promptForApi, negativeForApi);
        // 3. Apply Escalating Negatives
        if (retryCount - 1 < RETRY_STRATEGY.length) {
            negativeForApi += `, ${RETRY_STRATEGY[retryCount - 1]}`;
        }
        // 4. (Optional) Preserve Context by slightly shortening prompt
        // promptForApi = promptForApi.split(' ').slice(0, Math.floor(promptForApi.split(' ').length * 0.9)).join(' ');
        console.log(`Retry ${retryCount} - Using Negative Prompt: ${negativeForApi.substring(0, 200)}...`);
    } else {
        // Initial attempt - sanitize prompt
        promptForApi = sanitizePromptForNSFW(promptForApi);
        console.log(`Generating image with prompt: ${promptForApi.substring(0, 100)}...`);
    }


    // --- Call Replicate API ---
    try {
        const prediction = await replicate.predictions.create({
            version: versionId,
            input: {
                prompt: promptForApi,
                aspect_ratio: "16:9",
                output_format: "png",
                output_quality: 100,
                prompt_upsampling: true,
                negative_prompt: negativeForApi,
            },
        });
        predictionResult = await replicate.wait(prediction);

        // --- Check Result ---
        if (predictionResult.status === "succeeded") {
            // Check for NSFW score if available (adjust path as needed)
            // Example path: predictionResult.metrics?.safety?.nsfw_score_threshold_adjusted
            const nsfwScore = predictionResult.metrics?.nsfw_score; // Using a hypothetical score field
            if (nsfwScore && nsfwScore >= NSFW_THRESHOLD) {
                console.warn(`Attempt ${retryCount} succeeded but NSFW score (${nsfwScore}) exceeded threshold (${NSFW_THRESHOLD}). Retrying...`);
                errorMessage = `NSFW score ${nsfwScore} exceeded threshold ${NSFW_THRESHOLD}`;
                isFinalErrorNsfw = true;
                attemptFailed = true; // Treat high score as failure for retry logic
            } else {
                // Success!
                finalImageUrl = predictionResult.output as string;
                if (!finalImageUrl) {
                    // Should not happen if status is succeeded, but check anyway
                    errorMessage = "Prediction succeeded but output URL was missing";
                    attemptFailed = true; // Treat as failure
                } else {
                    console.log(`Successfully generated image on attempt ${retryCount}.`);
                    break; // Exit the loop on success
                }
            }
        } else {
            // Handle failed or canceled status
            errorMessage = predictionResult.error ? JSON.stringify(predictionResult.error) : `Prediction ${predictionResult.status}`;
            console.error(`Attempt ${retryCount} failed: ${errorMessage}`);
            attemptFailed = true;
            // Check if the error message indicates NSFW
            if (errorMessage?.toLowerCase().includes("nsfw")) {
                console.warn("NSFW detected in error message. Retrying...");
                isFinalErrorNsfw = true;
            } else {
                 // If it's a non-NSFW failure, break the loop immediately
                 break;
            }
        }
    } catch (error: any) {
        console.error(`Error during Replicate API call on attempt ${retryCount}:`, error);
        errorMessage = (error as Error).message;
        attemptFailed = true;
        // Check if the caught error message indicates NSFW
        if (errorMessage?.toLowerCase().includes("nsfw")) {
             console.warn("NSFW detected in caught error. Retrying...");
             isFinalErrorNsfw = true;
        } else {
            // If it's a non-NSFW failure, break the loop immediately
            break;
        }
    }

    // --- Prepare for next retry if needed ---
    if (attemptFailed && retryCount < MAX_RETRIES) {
        retryCount++;
        // Optionally add a small delay before retrying
        // await new Promise(resolve => setTimeout(resolve, 500));
    } else {
        // Max retries reached or non-NSFW error occurred
        break;
    }
  } // End of while loop

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
       errorMessage = `Failed to fetch/convert image: ${(fetchError as Error).message}`; // Store fetch error, provide context
       finalBase64Image = null; // Ensure we return error if fetch fails
       finalImageUrl = null; // Also nullify URL if fetch fails
    }
  }

  // --- Return Response ---
  if (finalBase64Image && finalImageUrl) {
    // Success: Return the base64 image
    return NextResponse.json({ imageBase64: finalBase64Image }, { status: 200 });
  } else {
    // Failure: Return the relevant error message from the loop/fetch process
    const finalErrorMessage = errorMessage || "Unknown error during image generation after retries.";
    // Use the tracked isFinalErrorNsfw flag
    return NextResponse.json({ error: finalErrorMessage, isNsfwError: isFinalErrorNsfw }, { status: 500 });
  }
}


// --- Helper Functions ---

// Basic prompt sanitization (can be expanded)
function sanitizePromptForNSFW(prompt: string): string {
    // Initial simple sanitization (can be kept or removed if retry logic is preferred)
    return prompt
        .replace(/\bnaked\b/gi, "clothed")
        .replace(/\bnudity\b/gi, "modesty")
        .replace(/\bshame\b/gi, "regret")
        .replace(/\bnakedness\b/gi, "vulnerability")
        .replace(/naked bodies/gi, "figures covered")
        .replace(/naked/gi, "clothed")
        .replace(/nude/gi, "clothed");
}

// Apply safety modifiers based on keywords (Example)
function applySafetyModifiers(prompt: string): string {
    let modifiedPrompt = prompt;
    if (/\b(woman|man|person|people|figure)\b/i.test(prompt)) {
        if (!prompt.match(/clothing|attire|dressed|wearing/i)) {
             modifiedPrompt += ", conservative clothing, professional attire";
        }
    }
    if (/\b(bedroom|private room)\b/i.test(prompt)) {
         modifiedPrompt += ", public space setting";
    }
     if (/\b(intimate|suggestive|provocative)\b/i.test(prompt)) {
         modifiedPrompt += ", appropriate posture, safe activities";
    }
    // Add more rules as needed
    return modifiedPrompt;
}

// Apply contextual negative prompts (Example)
function applyContextualNegatives(prompt: string, currentNegative: string): string {
    let updatedNegative = currentNegative;
    if (/\b(doctor|hospital|medical|surgery)\b/i.test(prompt)) {
        updatedNegative += ", blood, needles, surgical tools, graphic injury";
    }
    if (/\b(park|beach|street|outdoor)\b/i.test(prompt)) {
        updatedNegative += ", public nudity, indecent exposure";
    }
     if (/\b(bedroom|home|indoor)\b/i.test(prompt)) {
        updatedNegative += ", suggestive poses, inappropriate attire";
    }
    // Add more rules as needed
    return updatedNegative;
}

// NOTE: The createAlternativePrompt function is no longer needed with the retry logic
// function createAlternativePrompt(originalPrompt: string): string { ... }
