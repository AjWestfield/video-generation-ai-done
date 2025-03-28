import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "The OPENROUTER_API_KEY environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { script } = await request.json();

  try {
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
            content: `You are a professional visual designer who creates image prompts for videos.
            Based on the provided script, generate exactly 4 image prompts that will be used to create visuals for this video.
            Each image prompt should be highly detailed and descriptive to generate high-quality images.
            
            Divide the script into 4 logical sections, and create a compelling image prompt for each section.
            
            Your response must be a valid JSON object with this structure:
            {"imageSections": [{"scriptSection": "section title", "imagePrompt": "detailed prompt"}]}
            
            IMPORTANT: The response MUST be valid JSON with no line breaks inside the values.`
          },
          {
            role: "user",
            content: script,
          },
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `OpenRouter API error: ${response.status} ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error("Unexpected response format from OpenRouter API");
    }
    
    const content = data.choices[0].message.content;
    console.log("Raw model response:", content);
    
    // Look for JSON content in the response - find anything between curly braces
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from model response");
    }
    
    let jsonContent = jsonMatch[0];
    
    // Try to parse the extracted JSON
    let parsedContent;
    try {
      // Remove any backticks and "json" prefix that might be in the response
      jsonContent = jsonContent.replace(/```json|```/g, "").trim();
      parsedContent = JSON.parse(jsonContent);
      
      // Validate that the response has required fields
      if (!parsedContent.imageSections || !Array.isArray(parsedContent.imageSections)) {
        throw new Error("Missing imageSections field in JSON response");
      }
      
      // Ensure imageSections has the right structure
      parsedContent.imageSections = parsedContent.imageSections.slice(0, 4).map(section => ({
        scriptSection: section.scriptSection || "Section",
        imagePrompt: section.imagePrompt || "Default image prompt"
      }));
      
    } catch (e) {
      console.error("JSON parse error:", e);
      console.error("Attempted to parse:", jsonContent);
      
      // Try an alternative approach - extract image sections directly with regex
      try {
        const imageSections = [];
        const sectionMatches = jsonContent.matchAll(/"scriptSection"\s*:\s*"([^"]*)"\s*,\s*"imagePrompt"\s*:\s*"([^"]*)"/g);
        
        for (const match of sectionMatches) {
          if (match[1] && match[2]) {
            imageSections.push({
              scriptSection: match[1],
              imagePrompt: match[2]
            });
          }
        }
        
        if (imageSections.length > 0) {
          parsedContent = { imageSections };
        } else {
          throw new Error("Could not extract image sections");
        }
      } catch (extractError) {
        console.error("Extraction error:", extractError);
        
        // Emergency fallback - generate a basic structure if parsing fails
        parsedContent = {
          imageSections: [
            {
              scriptSection: "Introduction",
              imagePrompt: "A visual introduction to the topic"
            },
            {
              scriptSection: "Main Point 1",
              imagePrompt: "A visual representation of the first main point"
            },
            {
              scriptSection: "Main Point 2",
              imagePrompt: "A visual representation of the second main point"
            },
            {
              scriptSection: "Conclusion",
              imagePrompt: "A visual conclusion to the topic"
            }
          ]
        };
      }
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