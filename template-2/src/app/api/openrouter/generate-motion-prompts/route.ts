import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Get API key from environment variables
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const { prompts, model, context } = await req.json();
    
    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: missing or empty prompts array' },
        { status: 400 }
      );
    }

    // Use provided model or default to google/gemini-2.0-flash-001
    const modelId = model || 'google/gemini-2.0-flash-001';
    
    // Prepare system and user prompts for the model
    const systemPrompt = `You are an expert motion prompt creator for AI image-to-video animation. Given a list of static image descriptions, generate corresponding MOTION prompts for 5-second animation clips. The motion prompts should describe the desired camera movement (e.g., slow pan left, zoom in, static shot, tracking shot) and any key character/object actions needed to animate each static scene. Be concise and focus only on describing motion for a short clip.`;
    
    const userPrompt = `Generate motion prompts for these static image descriptions. Each will be used to animate a 5-second video clip:\n\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;

    console.log(`Generating motion prompts for ${prompts.length} images using ${modelId}`);
    
    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': 'https://localhost:3000',
        'X-Title': 'AI Video Creator'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return NextResponse.json(
        { error: `OpenRouter API error: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      console.error('Unexpected response format from OpenRouter:', data);
      return NextResponse.json(
        { error: 'Invalid response from OpenRouter API' },
        { status: 500 }
      );
    }

    // Parse motion prompts from the response
    const responseContent = data.choices[0].message.content;
    console.log('OpenRouter Response:', responseContent);
    
    // Extract motion prompts, handling different possible formats
    let motionPrompts: string[] = [];
    
    // Try to parse as numbered list (1. prompt\n2. prompt)
    const numberedPattern = /^\d+\.\s*(.*)/gm;
    let matches = [...responseContent.matchAll(numberedPattern)];
    
    if (matches.length > 0 && matches.length === prompts.length) {
      motionPrompts = matches.map(match => match[1].trim());
    } else {
      // Fallback to splitting by newlines and cleaning up
      motionPrompts = responseContent
        .split('\n')
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(line => line.length > 0);
      
      // If we got too many or too few prompts, take the first N where N = number of input prompts
      if (motionPrompts.length !== prompts.length) {
        console.warn(`Generated ${motionPrompts.length} motion prompts, expected ${prompts.length}. Adjusting...`);
        if (motionPrompts.length > prompts.length) {
          motionPrompts = motionPrompts.slice(0, prompts.length);
        } else {
          // If too few, fill with generic prompts
          const originalLength = motionPrompts.length;
          for (let i = originalLength; i < prompts.length; i++) {
            motionPrompts.push(`Gentle camera movement with subtle zoom in for the scene: ${prompts[i].substring(0, 30)}...`);
          }
        }
      }
    }

    console.log(`Generated ${motionPrompts.length} motion prompts`);
    
    return NextResponse.json({ 
      motionPrompts,
      originalPrompts: prompts 
    });
    
  } catch (error: any) {
    console.error('Error generating motion prompts:', error);
    return NextResponse.json(
      { error: `Failed to generate motion prompts: ${error.message}` },
      { status: 500 }
    );
  }
} 