import { NextResponse } from "next/server";
import Replicate from "replicate";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

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

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    console.log("Generating sound effect with prompt:", prompt);

    // Use the Tango model to generate the sound effect
    console.log("Creating prediction with Tango model...");
    const prediction = await replicate.predictions.create({
      version: "740e4f5e59bd3b871c9e5b4efbff7ded516d40aa6abf4e95fd5e8dd149b7bc3f",
      input: {
        model: "tango2",
        prompt: prompt,
        steps: 100,
        guidance: 3
      }
    });
    
    // Wait for the prediction to complete
    let finalOutput = null;
    let attempts = 0;
    const maxAttempts = 60; // Maximum 5 minutes (60 * 5s)
    
    while (!finalOutput && attempts < maxAttempts) {
      attempts++;
      console.log(`Checking sound effect prediction status (attempt ${attempts})...`);
      
      const predictionResult = await replicate.predictions.get(prediction.id);
      
      if (predictionResult.status === "succeeded") {
        finalOutput = predictionResult.output;
        break;
      } else if (predictionResult.status === "failed") {
        throw new Error(`Prediction failed: ${predictionResult.error || "Unknown error"}`);
      } else if (predictionResult.status === "processing") {
        console.log("Sound effect prediction still processing...");
      } else {
        console.log("Sound effect prediction status:", predictionResult.status);
      }
      
      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    if (!finalOutput) {
      throw new Error("Timed out waiting for sound effect generation");
    }
    
    console.log("Sound effect generation successful. Output:", finalOutput);
    
    // Extract the URL from the prediction output
    let audioUrl: string;
    
    if (typeof finalOutput === 'string') {
      audioUrl = finalOutput;
    } else if (Array.isArray(finalOutput)) {
      audioUrl = finalOutput[0]; 
    } else {
      console.error("Unexpected prediction output format:", finalOutput);
      throw new Error("Unexpected response format from prediction API");
    }
    
    if (!audioUrl) {
      throw new Error("No valid audio URL found in prediction API response");
    }
    
    console.log("Extracted sound effect URL from prediction:", audioUrl);
    
    return NextResponse.json({
      soundEffectUrl: audioUrl
    }, { status: 200 });
  } catch (error) {
    console.error("Error generating sound effect:", error);
    
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