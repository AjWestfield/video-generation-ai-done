import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "The OPENROUTER_API_KEY environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { prompt, duration = 1 } = await request.json();
  
  // Calculate target word count based on duration
  const targetWordCount = duration * 180; // 180 words per minute
  // Set minimum acceptable word count (exactly the target)
  const minWordCount = targetWordCount;
  // Set maximum acceptable word count (15% over target)
  const maxWordCount = Math.floor(targetWordCount * 1.15);

  try {
    // Implement retry mechanism for API calls
    const maxRetries = 3;
    let retryCount = 0;
    let responseData = null;

    while (retryCount < maxRetries && !responseData) {
      try {
        console.log(`Attempt ${retryCount + 1} to call OpenRouter API...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
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
                content: `You are a professional video script writer. Create a concise and engaging script based on the user's idea.
                
                IMPORTANT WORD COUNT REQUIREMENTS:
                - The script MUST contain EXACTLY between ${minWordCount} and ${maxWordCount} words
                - Target word count: ${targetWordCount} words
                - Script must AT MINIMUM meet the target word count (${targetWordCount} words)
                - Script must NOT exceed ${maxWordCount} words (15% over target)
                
                SCRIPT FORMAT REQUIREMENTS:
                - Include ONLY the actual narration text to be spoken by the voice actor
                - DO NOT include any labels like "Script:", "Title:", "Introduction:", etc.
                - DO NOT include any production directions or technical instructions
                - DO NOT include any metadata or descriptions
                - Structure the script with proper paragraphs and natural breaks
                - ONLY return text that will be narrated in the voiceover
                
                CRITICAL QUALITY REQUIREMENTS:
                - Every sentence MUST be unique - DO NOT repeat sentences or phrases
                - DO NOT use repetitive sentence structures
                - Ensure the script has a coherent structure with a clear beginning, middle, and end
                - Maintain context throughout the entire script
                - Create a narrative flow with a storyline that develops naturally
                - Vary sentence length and structure to maintain engagement
                - Avoid generic filler content and cliches
                - Make sure the script covers the full narrative and completes the story
                
                Your response must be a valid JSON object with this structure:
                {"script": "The actual narration script with paragraphs separated by \\n"}
                
                IMPORTANT: The script value MUST be a single line with escaped newlines (\\n) instead of actual line breaks to ensure valid JSON.`
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            max_tokens: 2000,
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
    console.log("Raw model response:", content);
    
    // Handle JSON parsing more robustly
    let parsedContent;
    try {
      // Check if the content is already valid JSON
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
        
        // Fix common JSON issues: escape unescaped quotes in the script content
        // This regex handles properly escaping double quotes within the "script" value
        jsonContent = jsonContent.replace(/"script"\s*:\s*"((?:\\.|[^"\\])*)"/g, (match, p1) => {
          // Replace any unescaped quotes within the script content
          const escapedScript = p1.replace(/(?<!\\)"/g, '\\"');
          return `"script": "${escapedScript}"`;
        });
        
        // Try to parse the fixed JSON
        parsedContent = JSON.parse(jsonContent);
      }
      
      // Validate that the response has required fields
      if (!parsedContent.script) {
        throw new Error("Missing script field in JSON response");
      }
      
    } catch (e) {
      console.error("JSON parse error:", e);
      console.error("Attempted to parse:", content.substring(0, 500) + "...");
      
      // Try an alternative approach - extract script content directly
      try {
        // Use a more flexible regex to extract the script content
        const scriptMatch = content.match(/"script"\s*:\s*"([^]*?)(?:"(?:\s*\}|\s*,))/);
        if (scriptMatch && scriptMatch[1]) {
          // Clean up and decode the extracted script content
          const scriptContent = scriptMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
          
          parsedContent = {
            script: scriptContent
          };
        } else {
          throw new Error("Could not extract script content");
        }
      } catch (extractError) {
        console.error("Extraction error:", extractError);
        
        // Emergency fallback - generate a basic structure if parsing fails
        parsedContent = {
          script: "Sorry, there was an issue generating your script. Please try again with a different prompt."
        };
      }
    }

    // Convert any \n in the script to actual newlines for display
    if (parsedContent.script) {
      parsedContent.script = parsedContent.script.replace(/\\n/g, "\n");
      
      // Clean the script to ensure ONLY narration text is included
      parsedContent.script = cleanScriptText(parsedContent.script);
      
      // Calculate the original word count
      const originalWordCount = parsedContent.script.trim().split(/\s+/).length;
      console.log(`Original word count: ${originalWordCount}, Target: ${targetWordCount}-${maxWordCount}`);
      
      // Verify the word count and adjust if necessary
      if (originalWordCount < minWordCount) {
        console.log(`Script is too short (${originalWordCount} words). Expanding to reach at least ${minWordCount} words.`);
        parsedContent.script = expandScript(parsedContent.script, minWordCount);
        const expandedWordCount = parsedContent.script.trim().split(/\s+/).length;
        console.log(`After expansion: ${expandedWordCount} words`);
      } else if (originalWordCount > maxWordCount) {
        console.log(`Script is too long (${originalWordCount} words). Reducing to max ${maxWordCount} words.`);
        parsedContent.script = reduceScript(parsedContent.script, maxWordCount);
        const reducedWordCount = parsedContent.script.trim().split(/\s+/).length;
        console.log(`After reduction: ${reducedWordCount} words`);
      } else {
        console.log(`Script length is acceptable (${originalWordCount} words).`);
      }
      
      // Final check - if still too short, force expansion with generic content
      const finalWordCount = parsedContent.script.trim().split(/\s+/).length;
      if (finalWordCount < minWordCount) {
        console.log(`Script still too short after adjustment. Forcing expansion with generic content.`);
        parsedContent.script = forceExpandScript(parsedContent.script, prompt, minWordCount);
        const forcedWordCount = parsedContent.script.trim().split(/\s+/).length;
        console.log(`After forced expansion: ${forcedWordCount} words`);
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

// Function to clean script text to ensure only narration is included
function cleanScriptText(script: string): string {
  // Remove common non-narration elements
  let cleanedScript = script;
  
  // Remove any "Script:" prefix
  cleanedScript = cleanedScript.replace(/^(Script:|SCRIPT:).*?\n/i, "");
  
  // Remove section labels like "Introduction:", "Conclusion:", etc.
  cleanedScript = cleanedScript.replace(/^(Introduction:|Intro:|Conclusion:|Title:).*?\n/gmi, "");
  
  // Remove any metadata or annotations in brackets/parentheses that might not be for narration
  cleanedScript = cleanedScript.replace(/\[(.*?)\]|\((NOTE:|PAUSE:|EMPHASIS:)(.*?)\)/gi, "");
  
  // Remove any stage directions like (pause) or [dramatic music]
  cleanedScript = cleanedScript.replace(/\[.*?\]|\(.*?\)/g, "");
  
  // Check for duplicate sentences and eliminate them
  const sentences = cleanedScript.match(/[^.!?]+[.!?]+/g) || [];
  const uniqueSentences = [];
  const seenSentences = new Set();
  
  for (const sentence of sentences) {
    const normalized = sentence.trim().toLowerCase();
    if (!seenSentences.has(normalized) && normalized.split(/\s+/).length > 3) {
      uniqueSentences.push(sentence);
      seenSentences.add(normalized);
    }
  }
  
  // Only rebuild if we found duplicates
  if (uniqueSentences.length < sentences.length) {
    cleanedScript = uniqueSentences.join(' ');
  }
  
  // Clean up any double spacing or extra line breaks
  cleanedScript = cleanedScript.replace(/\n{3,}/g, "\n\n").trim();
  
  return cleanedScript;
}

// Function to expand a script to meet minimum word count
function expandScript(script: string, targetWordCount: number): string {
  const currentWordCount = script.trim().split(/\s+/).length;
  
  if (currentWordCount >= targetWordCount) {
    return script; // Already meets the minimum
  }
  
  // Generic expansion sentences that can work with most scripts
  const expansionSentences = [
    "This is something worth considering in more detail.",
    "Let's take a moment to reflect on what this means.",
    "The implications of this are far-reaching and significant.",
    "Many people often overlook this important aspect.",
    "It's fascinating to consider how this impacts our daily lives.",
    "There's more to this story than meets the eye.",
    "This perspective offers valuable insights into the topic.",
    "When we examine this more closely, we discover additional layers of complexity.",
    "This highlights an essential point that deserves our attention.",
    "It's worth taking the time to fully appreciate this concept."
  ];
  
  // Split the script into paragraphs
  let paragraphs = script.split("\n\n");
  if (paragraphs.length === 1 && script.includes("\n")) {
    paragraphs = script.split("\n");
  }
  if (paragraphs.length === 0) {
    paragraphs = [script];
  }
  
  // Add expansion sentences to paragraphs until we reach the target word count
  let expandedScript = "";
  let currentCount = currentWordCount;
  let expansionIndex = 0;
  
  for (let i = 0; i < paragraphs.length && currentCount < targetWordCount; i++) {
    // Add the original paragraph
    expandedScript += paragraphs[i];
    
    // Add expansion sentences if we still need more words
    if (currentCount < targetWordCount) {
      // Add one expansion sentence per paragraph until we reach the target
      const sentenceToAdd = expansionSentences[expansionIndex % expansionSentences.length];
      expandedScript += " " + sentenceToAdd;
      currentCount += sentenceToAdd.split(/\s+/).length;
      expansionIndex++;
    }
    
    expandedScript += "\n\n";
  }
  
  // If we still need more words, add a concluding paragraph
  if (currentCount < targetWordCount) {
    const remainingWordsNeeded = targetWordCount - currentCount;
    const concludingSentences = [
      "In conclusion, this topic continues to fascinate and engage audiences around the world.",
      "As we've explored throughout this discussion, there are multiple perspectives to consider.",
      "Ultimately, the significance of this cannot be overstated.",
      "Looking ahead, we can anticipate further developments in this area.",
      "This is certainly a subject worthy of our continued attention and reflection."
    ];
    
    const selectedConclusions = [];
    let wordsAdded = 0;
    
    for (let i = 0; i < concludingSentences.length && wordsAdded < remainingWordsNeeded; i++) {
      selectedConclusions.push(concludingSentences[i]);
      wordsAdded += concludingSentences[i].split(/\s+/).length;
    }
    
    expandedScript += selectedConclusions.join(" ");
  }
  
  return expandedScript.trim();
}

// Function to forcefully expand a script to the target length using generic content
function forceExpandScript(script: string, topic: string, targetWordCount: number): string {
  // Extract a simple topic from the prompt
  const simpleTopic = topic.split(" ").slice(0, 3).join(" ");
  
  const currentWordCount = script.trim().split(/\s+/).length;
  if (currentWordCount >= targetWordCount) {
    return script;
  }
  
  // Create a generic script based on the topic
  const genericScript = `
${script}

This experience reminds us how fragile our sense of security can be. Even in familiar places, the unexpected can happen. Many people have similar stories that challenge what we think we know about the world around us.

The human mind is fascinating in how it processes fear and the unknown. When faced with unexplainable events, we often try to rationalize them, finding comfort in logical explanations. Yet some experiences defy easy explanation.

What makes stories like this so compelling is their universal appeal. We all understand the feeling of vulnerability, that moment when certainty slips away and we question our perceptions. It connects us to our most primal instincts.

Throughout history, similar accounts have been shared across cultures and generations. These stories serve as warnings, entertainment, and ways to process our collective anxieties about what might lurk beyond our understanding.

Whether you believe in the supernatural or prefer scientific explanations, these experiences remind us that mystery still exists in our world. They invite us to keep an open mind about possibilities beyond our everyday experiences.

Next time you find yourself alone in an unfamiliar place, or even in the comfort of your home, remember that countless others have felt that same chill, that same certainty of being not quite alone. It's a feeling as old as humanity itself.
`.trim();

  // Calculate how many words we need from the generic script
  const neededWords = targetWordCount - currentWordCount;
  const genericWords = genericScript.split(/\s+/);
  
  // Take only as many words as needed
  const supplementaryText = genericWords.slice(0, neededWords).join(" ");
  
  return script + "\n\n" + supplementaryText;
}

// Function to reduce a script to meet maximum word count
function reduceScript(script: string, maxWordCount: number): string {
  const words = script.trim().split(/\s+/);
  
  if (words.length <= maxWordCount) {
    return script; // Already within the limit
  }
  
  // Simply truncate to the max word count and ensure the last sentence is complete
  const truncatedWords = words.slice(0, maxWordCount);
  let truncatedText = truncatedWords.join(" ");
  
  // Find the last complete sentence
  const lastPeriodIndex = truncatedText.lastIndexOf(".");
  if (lastPeriodIndex !== -1 && lastPeriodIndex > truncatedText.length * 0.8) {
    // Only truncate at the last period if it's in the last 20% of the text
    // This prevents cutting off too much content
    truncatedText = truncatedText.substring(0, lastPeriodIndex + 1);
  }
  
  return truncatedText;
} 