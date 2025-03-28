import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "The OPENROUTER_API_KEY environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { script, audioDuration, interval = 4 } = await request.json();

  try {
    // Calculate how many images we need based on the audio duration and interval
    // Allow for a much higher number of images
    const maxImages = 1000; // Previously limited to 30 images maximum
    const calculatedImages = Math.max(1, Math.ceil(audioDuration / interval));
    const numImages = Math.min(calculatedImages, maxImages);
    
    // If we had to limit the images, adjust the interval to spread them evenly
    const actualInterval = numImages < calculatedImages ? audioDuration / numImages : interval;
    
    // Generate timestamps for each image
    const timestamps = Array.from({ length: numImages }, (_, i) => {
      return {
        startTime: i * actualInterval,
        endTime: Math.min((i + 1) * actualInterval, audioDuration),
        formattedTime: formatTimestamp(i * actualInterval) + "-" + formatTimestamp(Math.min((i + 1) * actualInterval, audioDuration))
      };
    });

    console.log(`Generating ${numImages} image prompts at intervals of approximately ${actualInterval.toFixed(2)} seconds`);

    // Implement retry mechanism for API calls
    const maxRetries = 3;
    let retryCount = 0;
    let responseData = null;

    while (retryCount < maxRetries && !responseData) {
      try {
        console.log(`Attempt ${retryCount + 1} to generate image prompts...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        // Prepare the request for the AI to generate prompts
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://localhost:3000",
            "X-Title": "AI Video Creator"
          },
          body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL_ID || "google/gemini-2.0-flash-001",
            messages: [
              {
                role: "system",
                content: `You are a specialized AI Image Prompt Generator that creates detailed, timestamped prompts for voice-synchronized visuals. Your task is to analyze the provided script/voiceover content thoroughly and divide it into ${numImages} segments of approximately ${actualInterval.toFixed(2)} seconds each.

For each segment, you'll generate a highly detailed photorealistic image prompt that precisely matches what is being discussed at that exact moment in the script.

Follow these specific guidelines:
- Create prompts that capture the essence of what's being spoken about at each timestamp
- Ensure prompts are extremely detailed and descriptive (minimum 30-50 words each)
- Focus exclusively on photorealistic imagery - specify lighting, angle, composition, mood, and environment
- NEVER include instructions that would generate text, words, numbers, or labels within the images
- Include specific artistic direction such as "shallow depth of field," "golden hour lighting," or "aerial perspective" when appropriate
- Maintain narrative continuity between sequential images
- Each prompt MUST begin with "photo realistic"
- Always specify "16:9 aspect ratio, landscape orientation" to ensure proper formatting
- Ensure all prompts collectively cover the entire script narrative from beginning to end
- Avoid abstract concepts that don't translate well visually
- Make sure the final prompt reaches the conclusion of the story/script

Your response MUST be a valid JSON object with exactly this structure:
{"imagePrompts": [{"timestamp": number, "prompt": "photo realistic [detailed description]"}]}

The timestamp value represents the number of seconds into the voiceover when this image should appear.
IMPORTANT: Keep your total output under 100KB to avoid truncation issues.`
              },
              {
                role: "user",
                content: `Script: ${script.substring(0, 5000)}
                
Audio duration: ${audioDuration} seconds

I need ${numImages} highly detailed, photorealistic image prompts for these segments:
${timestamps.slice(0, 15).map(t => `- [${t.formattedTime}]: (${Math.floor(t.startTime)} seconds into the audio)`).join('\n')}
${numImages > 15 ? `...and ${numImages - 15} more segments` : ''}

Create prompts that precisely match what would be spoken at each timestamp in the script, with extensive visual detail (lighting, composition, emotion, setting, etc.). Keep visual continuity with adjacent segments.`
              },
            ],
            max_tokens: 8000,
            temperature: 0.7,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Failed to parse error response" }));
          throw new Error(
            `OpenRouter API error: ${response.status} ${JSON.stringify(errorData)}`
          );
        }

        const data = await response.json();
        responseData = data;
        break;
        
      } catch (error) {
        retryCount++;
        console.error(`Attempt ${retryCount} failed:`, error);
        
        if (error.name === 'AbortError') {
          console.log('Request timed out, retrying...');
        }
        
        // If we've exhausted all retries, throw the error
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`Waiting ${delay}ms before retry ${retryCount + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    const data = responseData;
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error("Unexpected response format from OpenRouter API");
    }
    
    const content = data.choices[0].message.content;
    console.log("Raw model response length:", content.length);
    console.log("Raw model response (truncated):", content.substring(0, 500) + "...");
    
    // Handle JSON parsing more robustly
    let parsedContent;
    try {
      // Try direct parsing first
      try {
        parsedContent = JSON.parse(content);
      } catch (initialParseError) {
        // Look for JSON content in the response - find anything between curly braces
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          throw new Error("Could not extract JSON from model response");
        }
        
        let jsonContent = jsonMatch[0];
        
        // Remove any backticks and "json" prefix that might be in the response
        jsonContent = jsonContent.replace(/```json|```/g, "").trim();
        
        // Handle truncated JSON by adding missing closing brackets
        if (!jsonContent.endsWith("}")) {
          // Find the last complete image prompt object
          const lastCompleteObjectMatch = jsonContent.match(/.*"prompt":.*?"[^"]*".*?\}/g);
          if (lastCompleteObjectMatch) {
            // Extract up to the last complete object
            const lastCompleteObject = lastCompleteObjectMatch[lastCompleteObjectMatch.length - 1];
            const objectIndex = jsonContent.lastIndexOf(lastCompleteObject) + lastCompleteObject.length;
            jsonContent = jsonContent.substring(0, objectIndex) + "]}";
          } else {
            // If we can't find any complete objects, try a simple fix
            jsonContent += "]}";
          }
        }
        
        parsedContent = JSON.parse(jsonContent);
      }
      
      // Validate that the response has required fields
      if (!parsedContent.imagePrompts || !Array.isArray(parsedContent.imagePrompts)) {
        throw new Error("Missing imagePrompts field in JSON response");
      }
      
      // Ensure all prompts begin with "photo realistic"
      parsedContent.imagePrompts = parsedContent.imagePrompts.map(item => ({
        timestamp: item.timestamp || 0,
        prompt: item.prompt.startsWith("photo realistic") 
          ? item.prompt 
          : `photo realistic ${item.prompt}`
      }));
      
      // Add 16:9 aspect ratio if not present
      parsedContent.imagePrompts = parsedContent.imagePrompts.map(item => ({
        timestamp: item.timestamp || 0,
        prompt: item.prompt.includes("16:9") 
          ? item.prompt 
          : `${item.prompt}, 16:9 aspect ratio, landscape orientation`
      }));
      
      // Sort prompts by timestamp
      parsedContent.imagePrompts.sort((a, b) => a.timestamp - b.timestamp);
      
      // Ensure we have prompts for each timestamp
      const generatedTimestamps = new Set(parsedContent.imagePrompts.map(p => Math.floor(p.timestamp)));
      
      // Create missing prompts for timestamps we don't have
      for (let i = 0; i < numImages; i++) {
        const timestamp = Math.floor(i * actualInterval);
        if (!generatedTimestamps.has(timestamp)) {
          // Extract a relevant portion of the script for this timestamp
          const scriptSegmentStart = Math.floor((script.length * timestamp) / audioDuration);
          const scriptSegmentEnd = Math.min(script.length, scriptSegmentStart + 200);
          const scriptSegment = script.substring(scriptSegmentStart, scriptSegmentEnd).split(' ').slice(0, 20).join(' ');
          
          parsedContent.imagePrompts.push({
            timestamp: timestamp,
            prompt: `photo realistic detailed scene depicting: "${scriptSegment}..." with cinematic lighting, rich details, and emotional depth. 16:9 aspect ratio, landscape orientation`
          });
        }
      }
      
      // Re-sort and limit to the number of images we need
      parsedContent.imagePrompts.sort((a, b) => a.timestamp - b.timestamp);
      if (parsedContent.imagePrompts.length > numImages) {
        parsedContent.imagePrompts = parsedContent.imagePrompts.slice(0, numImages);
      }
      
    } catch (e) {
      console.error("JSON parse error:", e);
      console.error("Attempted to parse:", content.substring(0, 500) + "...");
      
      // Emergency fallback - generate a basic structure
      parsedContent = {
        imagePrompts: timestamps.map((t, index) => {
          // Extract a relevant portion of the script for this timestamp
          const scriptSegmentStart = Math.floor((script.length * t.startTime) / audioDuration);
          const scriptSegmentEnd = Math.min(script.length, scriptSegmentStart + 200);
          const scriptSegment = script.substring(scriptSegmentStart, scriptSegmentEnd).split(" ").slice(0, 20).join(" ");
          
          return {
            timestamp: Math.floor(t.startTime),
            prompt: `photo realistic detailed scene depicting: "${scriptSegment}...". High-quality cinematographic composition with professional lighting, rich details, and emotional depth. 16:9 aspect ratio, landscape orientation`
          };
        })
      };
    }

    return NextResponse.json(parsedContent, { status: 200 });
  } catch (error) {
    console.error("Error from OpenRouter API:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// Helper function to format timestamps as MM:SS
function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
} 