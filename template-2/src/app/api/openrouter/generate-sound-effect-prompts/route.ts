import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { script, images, timedImages } = await request.json();

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not set" },
        { status: 500 }
      );
    }

    if (!script && (!images || images.length === 0) && (!timedImages || timedImages.length === 0)) {
      return NextResponse.json(
        { error: "Script or images are required" },
        { status: 400 }
      );
    }

    // Use timed images if available, otherwise use regular images
    const imageData = timedImages && timedImages.length > 0 
      ? timedImages 
      : (images || []).map((img, i) => ({ 
          imageBase64: img, 
          timestamp: i * 4 // Rough estimate, 4 seconds per image
        }));

    const modelId = process.env.OPENROUTER_MODEL_ID || "google/gemini-2.0-flash-001";

    const systemPrompt = `
    You are a sound effect director for videos. Your task is to identify ONLY the most important key moments in a script and images that would benefit from sound effects.
    
    Analyze the script and images provided and determine:
    1. Identify ONLY 3-5 key moments that would benefit MOST from sound effects
    2. Select timestamps where sound effects would have the most impact on viewer engagement
    3. Create detailed sound effect prompts for the Tango AI sound generation model
    4. Focus on sounds that would naturally occur in the scene or enhance emotional impact
    5. Do NOT suggest sound effects for every scene or image - be highly selective
    
    Format each sound effect as a JSON object with the following fields:
    - timestamp: The exact time in seconds when the sound should occur
    - prompt: A detailed description of the sound effect for Tango
    
    Return a JSON array of sound effect objects, with no more than 5 total sound effects.
    `;

    console.log("Generating selective sound effect prompts based on script and images");

    // Prepare image descriptions for the API call
    const imageDescriptions = imageData.map(item => {
      return {
        timestamp: item.timestamp,
        // Remove data URL prefix for base64 images to save token space
        image: item.imageBase64.startsWith('data:') 
          ? item.imageBase64 
          : `Image at timestamp ${item.timestamp}`
      };
    });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://www.futureai.dev",
        "X-Title": "AI Video Creator"
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Generate sound effect prompts based on the following script and images. Choose ONLY the 3-5 most impactful moments.
                
                Script: ${script || "No script provided, focus on the visual elements."}`
              },
              {
                type: "text",
                text: `The images in the video appear at specific timestamps. Carefully analyze the content and choose ONLY the most significant moments for sound effects. Remember, fewer, well-placed sound effects are better than too many.
                
                Here are the timestamps of the key images:
                ${imageData.map(img => `- Timestamp ${img.timestamp} seconds`).join('\n')}`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate sound effect prompts");
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error("Invalid response from OpenRouter API");
    }

    // Parse the model response - it should be a JSON array of sound effect objects
    const responseContent = data.choices[0].message.content.trim();
    console.log("Raw model response:", responseContent);
    
    let soundEffects = [];
    
    // Extract JSON from the response (handle if model returns markdown or extra text)
    try {
      // Try to find JSON array in the response
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        soundEffects = JSON.parse(jsonMatch[0]);
      } else {
        // If no array found, try to parse the entire response as JSON
        soundEffects = JSON.parse(responseContent);
      }
      
      // Ensure result is an array
      if (!Array.isArray(soundEffects)) {
        soundEffects = [soundEffects];
      }
      
      // Limit to max 5 sound effects
      soundEffects = soundEffects.slice(0, 5);
    } catch (error) {
      console.error("Error parsing sound effects JSON:", error);
      throw new Error("Failed to parse sound effect data from model response");
    }
    
    console.log("Generated selective sound effect prompts:", JSON.stringify(soundEffects, null, 2));

    return NextResponse.json({ 
      soundEffects: soundEffects
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error generating sound effect prompts:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
} 