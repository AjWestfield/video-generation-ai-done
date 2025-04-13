import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { klingModelReference } from '../kling-model-reference';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

if (!process.env.REPLICATE_API_TOKEN) {
  console.error("FATAL: REPLICATE_API_TOKEN environment variable is not set.");
}

interface RequestBody {
  // Expecting base64 images now
  images: { base64: string; prompt: string }[]; 
}

interface VideoResult {
  url: string;
  prompt: string; // This will store the motion prompt used
  duration?: number; // Optional duration
  model?: string; // The model ID that generated this video
}

// Function to generate MOTION prompts using OpenRouter
async function generateMotionPrompts(originalPrompts: string[]): Promise<string[]> {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    console.error("Cannot generate motion prompts: OPENROUTER_API_KEY not configured.");
    // Fallback: Return prompts that indicate an error or just pass originals? 
    // For now, returning originals might lead to less confusing video output than error messages.
    return originalPrompts.map(p => `Error generating motion: ${p}`); 
  }

  const modelId = "google/gemini-2.0-flash-001"; // Use the specified model
  const systemPrompt = `You are an expert video animator. Given a list of static image prompts describing scenes in sequence, generate a corresponding list of concise MOTION prompts. Each motion prompt should describe the desired camera movement (e.g., slow pan left, zoom in, static shot, tracking shot) and any key character/object actions needed to animate the static scene described in the original prompt, ensuring smooth transitions and continuity between scenes. Focus ONLY on describing the motion/action for a short clip (approx 5 seconds). Output ONLY the motion prompts, one per line, matching the number of input prompts.`;
  const userPrompt = `Generate ${originalPrompts.length} motion prompts for the following static image prompts:\n\n${originalPrompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;

  try {
    console.log(`Generating ${originalPrompts.length} motion prompts using OpenRouter model: ${modelId}`);
    console.log(`OpenRouter API Key (first 5 chars): ${openRouterApiKey.substring(0, 5)}***`);
    console.log(`Original prompts: ${JSON.stringify(originalPrompts)}`);
    
    const requestBody = {
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2048, 
      temperature: 0.6, 
    };
    
    console.log(`OpenRouter Request Body: ${JSON.stringify(requestBody)}`);
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openRouterApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`OpenRouter Response Status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API error (${response.status}) for motion prompts - Raw response:`, errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        console.error(`OpenRouter API error parsed:`, JSON.stringify(errorData));
      } catch (parseError) {
        console.error(`Could not parse error response as JSON:`, parseError);
      }
      
      return originalPrompts.map(p => `API Error: ${p}`); // Fallback
    }

    const responseText = await response.text();
    console.log(`OpenRouter Raw Response Text: ${responseText}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`Error parsing OpenRouter response as JSON:`, parseError);
      return originalPrompts.map(p => `Parse Error: ${p}`);
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      console.error("Unexpected response format from OpenRouter API for motion prompts:", data);
      return originalPrompts.map(p => `Format Error: ${p}`); // Fallback
    }

    const responseContent = data.choices[0].message.content;
    console.log("OpenRouter Response Content:", responseContent);
    
    const motionPrompts = responseContent
      .split('\n')
      .map((line: string) => line.replace(/^\d+\.\s*/, '').trim()) 
      .filter(Boolean); 

    console.log("Parsed Motion Prompts:", motionPrompts);

    if (motionPrompts.length === originalPrompts.length) {
      console.log("Successfully generated motion prompts via OpenRouter.");
      return motionPrompts;
    } else {
      console.warn(`OpenRouter returned ${motionPrompts.length} motion prompts, expected ${originalPrompts.length}. Falling back.`);
      console.log("Raw response causing mismatch:", responseContent); 
      // Pad or truncate if mismatch, though falling back might be safer
      return originalPrompts.map(p => `Count Mismatch: ${p}`); // Fallback
    }

  } catch (error) {
    console.error("Error calling OpenRouter API for motion prompt generation:", error);
    return originalPrompts.map(p => `Fetch Error: ${p}`); // Fallback
  }
}


// Helper function to generate a single video using Replicate
async function generateSingleVideoReplicate(
  imageBase64: string, 
  motionPrompt: string, // Use the motion prompt
  index: number 
): Promise<VideoResult | null> {
  
  // Ensure base64 string has the data URI prefix
  let formattedImageInput = imageBase64;
  if (!formattedImageInput.startsWith('data:')) {
     const mimeType = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/png';
     formattedImageInput = `data:${mimeType};base64,${imageBase64.split(',')[1] || imageBase64}`;
  }

  // Define model ID types to match Replicate API expectations
  type ReplicateModelID = `${string}/${string}:${string}`;

  // Using the kwaivgi/kling-v1.6-standard model with the latest version ID
  const model = {
    id: "kwaivgi/kling-v1.6-standard:7e324e5fcb9479696f15ab6da262390cddf5a1efa2e11374ef9d1f85fc0f82da" as ReplicateModelID,
    inputParams: {
      prompt: motionPrompt,
      start_image: formattedImageInput,
      duration: 5,
      cfg_scale: 0.5,
      aspect_ratio: "16:9",
      negative_prompt: ""
    }
  };

  try {
    console.log(`--- Replicate API Call Input (Image ${index + 1}) ---`);
    console.log(`Model: ${model.id}`);
    console.log(`Motion Prompt: ${motionPrompt}`);
    console.log(`Parameters: ${JSON.stringify(model.inputParams)}`);
    
    const output: unknown = await replicate.run(
      model.id,
      { input: model.inputParams }
    );
    
    console.log(`Raw Replicate output:`, output);
    
    // Handle different possible output formats from Replicate
    let videoUrl: string | null = null;
    
    // Check for various error patterns
    if (typeof output === 'string') {
      if (output.startsWith('hello ')) {
        console.error(`Error pattern detected: "${output.substring(0, 50)}..."`);
        console.error("API appears to be echoing the input prompt instead of returning a video URL");
        return null;
      } else if (output.startsWith('http')) {
        // Case 1: Output is directly a URL string
        videoUrl = output;
      } else {
        console.error(`Unexpected string response: "${output.substring(0, 100)}..."`);
        console.error("Response is a string but not a valid URL");
        return null;
      }
    } else if (Array.isArray(output) && output.length > 0) {
      // Case 2: Output is an array, try to find a URL in it
      const possibleUrl = output.find(item => typeof item === 'string' && item.toString().startsWith('http'));
      if (possibleUrl) videoUrl = possibleUrl.toString();
    } else if (output && typeof output === 'object') {
      // Case 3: Output is an object, look for common URL properties
      const outputObj = output as Record<string, unknown>;
      const possibleUrlKeys = ['video', 'url', 'output', 'result'];
      for (const key of possibleUrlKeys) {
        const value = outputObj[key];
        if (value && typeof value === 'string' && value.startsWith('http')) {
          videoUrl = value;
          break;
        }
      }
    }

    if (videoUrl) {
      console.log(`Replicate video generated successfully: ${videoUrl}`);
      return {
        url: videoUrl,
        prompt: motionPrompt,
        duration: 5,
        model: model.id // Include which model generated this
      };
    } else {
      console.error(`Model did not return a valid video URL. Response:`, JSON.stringify(output));
      return null;
    }
  } catch (error) {
    console.error(`Error with model for image ${index + 1}:`, error);
    // Log the specific error detail if available
    if (error instanceof Error && (error as any).response?.data?.detail) {
      console.error(`Replicate model API Error Detail:`, (error as any).response.data.detail);
    }
    return null;
  }
}

// Main API Route Handler
export async function POST(req: NextRequest) {
  console.log('Animation API called');
  
  try {
    // Parse the JSON request body
    const { imageData, motionPrompt } = await req.json();
    
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error("FATAL: REPLICATE_API_TOKEN environment variable is not set.");
      return NextResponse.json(
        { error: 'Replicate API key not configured on server.' }, 
        { status: 500 }
      );
    }
    
    if (!imageData || !motionPrompt) {
      return NextResponse.json(
        { error: 'Missing required parameters: imageData and/or motionPrompt' }, 
        { status: 400 }
      );
    }
    
    // Handle single image or multiple images
    const images = Array.isArray(imageData) ? imageData : [imageData];
    const motionPrompts = Array.isArray(motionPrompt) ? motionPrompt : Array(images.length).fill(motionPrompt);
    
    // Process each image with the Kling model
    const animationPromises = images.map((image, index) => {
      // Format image properly for the API (ensure it's base64 or URL)
      const formattedImageInput = image.startsWith('data:') 
        ? image
        : `data:image/jpeg;base64,${image}`;
      
      console.log(`--- Replicate API Call Input (Image ${index + 1}) ---`);
      console.log(`Motion Prompt: ${motionPrompts[index]}`);
      
      // Create model prediction using the Kling model parameters
      return replicate.predictions.create({
        version: klingModelReference.latestVersion,
        input: {
          prompt: motionPrompts[index],
          start_image: formattedImageInput,
          duration: 5,
          cfg_scale: 0.5,
          aspect_ratio: "16:9",
          negative_prompt: ""
        }
      });
    });
    
    // Run all animation predictions in parallel
    const animationPredictions = await Promise.all(animationPromises);
    const predictionIds = animationPredictions.map(prediction => prediction.id);
    
    console.log(`Started ${predictionIds.length} animation predictions`);
    console.log('Prediction IDs:', predictionIds);
    
    // Return prediction IDs to client so they can poll for results
    return NextResponse.json({ 
      status: 'success',
      message: `Started ${predictionIds.length} animation predictions`,
      predictionIds: predictionIds
    });
    
  } catch (error: any) {
    console.error('Animation API error:', error);
    return NextResponse.json(
      { error: `Animation processing failed: ${error.message}` }, 
      { status: 500 }
    );
  }
}
