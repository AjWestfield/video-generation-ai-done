import { NextResponse } from "next/server";
import Replicate from "replicate";

export async function POST(request: Request) {
  try {
    const { 
      prompt, 
      model_version = "stereo-large",
      voiceoverDuration = 15 // Default to 15 seconds if not provided
    } = await request.json();

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN is not set" },
        { status: 500 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Log that we're using the provided voiceover duration
    console.log("Generating music to match voiceover duration:", voiceoverDuration, "seconds");
    
    // Ensure duration is a valid number and between allowed limits (MusicGen allows up to 300 seconds)
    // Adding 3 extra seconds to match the fade-out requirements
    const duration = Math.max(15, Math.min(Math.ceil(voiceoverDuration) + 3, 300)); 
    
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    console.log("Generating music with prompt:", prompt);
    console.log("Using music duration:", duration, "seconds");

    // Use the prediction API as the primary approach (since it works more reliably)
    console.log("Creating prediction with Replicate API...");
    const prediction = await replicate.predictions.create({
      version: "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
      input: {
        top_k: 250,
        top_p: 0,
        prompt: prompt,
        duration: duration,
        temperature: 1,
        continuation: false,
        model_version: model_version,
        output_format: "mp3",
        continuation_start: 0,
        multi_band_diffusion: false,
        normalization_strategy: "peak",
        classifier_free_guidance: 3
      }
    });
    
    // Wait for the prediction to complete
    let finalOutput = null;
    let attempts = 0;
    const maxAttempts = 120; // Maximum 10 minutes (120 * 5s)
    
    while (!finalOutput && attempts < maxAttempts) {
      attempts++;
      console.log(`Checking prediction status (attempt ${attempts})...`);
      
      const predictionResult = await replicate.predictions.get(prediction.id);
      
      if (predictionResult.status === "succeeded") {
        finalOutput = predictionResult.output;
        break;
      } else if (predictionResult.status === "failed") {
        throw new Error(`Prediction failed: ${predictionResult.error || "Unknown error"}`);
      } else if (predictionResult.status === "processing") {
        console.log("Prediction still processing...");
      } else {
        console.log("Prediction status:", predictionResult.status);
      }
      
      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    if (!finalOutput) {
      throw new Error("Timed out waiting for music generation");
    }
    
    console.log("Music generation successful. Output:", finalOutput);
    
    // Extract the URL from the prediction output
    let audioUrl: string;
    
    if (Array.isArray(finalOutput)) {
      audioUrl = finalOutput[0];
    } else if (typeof finalOutput === 'string') {
      audioUrl = finalOutput;
    } else if (finalOutput && typeof finalOutput === 'object') {
      const potentialUrl = Object.values(finalOutput).find(val => 
        typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))
      ) as string;
      
      if (potentialUrl) {
        audioUrl = potentialUrl;
      } else {
        console.error("Could not find URL in prediction output:", finalOutput);
        throw new Error("Could not extract audio URL from prediction response");
      }
    } else {
      console.error("Unexpected prediction output format:", finalOutput);
      throw new Error("Unexpected response format from prediction API");
    }
    
    if (!audioUrl) {
      throw new Error("No valid audio URL found in prediction API response");
    }
    
    console.log("Extracted audio URL from prediction:", audioUrl);
    
    return NextResponse.json({
      musicUrl: audioUrl,
      duration: duration
    }, { status: 200 });
  } catch (error) {
    console.error("Error generating music:", error);
    
    // Check for network errors specifically
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isNetworkError = errorMessage.includes("ECONNREFUSED") || 
                         errorMessage.includes("fetch failed") ||
                         errorMessage.includes("network");
    
    return NextResponse.json({
      error: isNetworkError 
        ? "Network error connecting to Replicate API. Please check your internet connection and try again."
        : errorMessage
    }, { status: 500 });
  }
} 