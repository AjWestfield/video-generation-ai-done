import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "The OPENROUTER_API_KEY environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { script } = await request.json();
  
  if (!script) {
    return NextResponse.json(
      { error: "No script provided" },
      { status: 400 }
    );
  }

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
            content: `You are an AI voice casting assistant. Analyze the provided script to determine the most appropriate voice characteristics for narration.
            
            Your task is to determine:
            1. The gender that would be most appropriate for narrating this script (male, female, or neutral)
            2. The tone that would fit best (e.g., warm, authoritative, friendly, professional, etc.)
            3. Any specific accent that might enhance the script (if applicable)
            4. Additional voice qualities that would complement the content (e.g., deep, young, old, calm, energetic)
            
            Based on the content, style, and context of the script, provide your analysis.
            
            Your response must be a valid JSON object with this structure:
            {
              "gender": "male|female|neutral",
              "tone": ["primary tone", "secondary tone"],
              "accent": "accent if applicable or null",
              "qualities": ["quality1", "quality2"]
            }`
          },
          {
            role: "user",
            content: `Please analyze this script and recommend voice characteristics:\n\n${script}`,
          },
        ],
        max_tokens: 500,
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
      if (!parsedContent.gender || !parsedContent.tone) {
        throw new Error("Missing required fields in JSON response");
      }
      
    } catch (e) {
      console.error("JSON parse error:", e);
      console.error("Attempted to parse:", jsonContent);
      
      // Fallback to default values if JSON parsing fails
      parsedContent = {
        gender: "neutral",
        tone: ["natural", "professional"],
        accent: null,
        qualities: ["clear", "articulate"]
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