import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { klingModelReference } from '../kling-model-reference';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

// Main API Route Handler
export async function GET(req: NextRequest) {
  console.log("Replicate Test API called");
  
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error("FATAL: REPLICATE_API_TOKEN environment variable is not set.");
    return NextResponse.json({ error: 'Replicate API key not configured on server.' }, { status: 500 });
  } else {
    console.log(`Replicate API token is set (first 5 chars): ${process.env.REPLICATE_API_TOKEN.substring(0, 5)}***`);
  }

  try {
    // Create a properly sized test image (Using a valid 300x300 base64 image)
    // This is a simple blue 300x300 PNG
    const testImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAACXBIWXMAAAsTAAALEwEAmpwYAAABOklEQVR4nO3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/gZ6Xwxi2xsDpgAAAABJRU5ErkJggg==";
    
    // Using the Kling model with the correct parameters
    const model = `${klingModelReference.modelId}:${klingModelReference.latestVersion}`;
    
    console.log(`Testing Kling model: ${model}`);
    
    const prediction = await replicate.predictions.create({
      version: klingModelReference.latestVersion,
      input: {
        prompt: "zoom in slowly with gentle camera movement",
        start_image: testImage,
        duration: 5,
        cfg_scale: 0.5,
        aspect_ratio: "16:9",
        negative_prompt: ""
      }
    });

    console.log("Prediction initiated:", prediction.id);
    
    // Poll for completion - use get method to properly resolve the prediction
    const result = await replicate.predictions.get(prediction.id);
    
    return NextResponse.json({ 
      status: "success", 
      model: model,
      result: result
    });
    
  } catch (error: any) {
    console.error("Error in Replicate API test:", error);
    return NextResponse.json({ 
      error: `API test failed: ${error.message}`,
      details: error
    }, { status: 500 });
  }
} 