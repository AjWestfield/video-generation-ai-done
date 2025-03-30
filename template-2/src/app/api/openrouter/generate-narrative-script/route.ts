import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "The OPENROUTER_API_KEY environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { prompt, duration = 1, storyStructure = "standard" } = await request.json();
  
  // Calculate target word count based on duration
  const targetWordCount = duration * 180; // 180 words per minute
  // Set minimum acceptable word count (exactly the target)
  const minWordCount = targetWordCount;
  // Set maximum acceptable word count (15% over target)
  const maxWordCount = Math.floor(targetWordCount * 1.15);
  
  // Max attempts to generate a script without duplicate sentences
  const maxGenerationAttempts = 3;
  let generationAttempt = 0;
  let finalScript = null;
  
  // Get narrative structure prompt based on requested structure type
  const narrativePrompt = getNarrativeStructurePrompt(storyStructure);

  while (generationAttempt < maxGenerationAttempts && finalScript === null) {
    generationAttempt++;
    console.log(`Narrative script generation attempt ${generationAttempt} of ${maxGenerationAttempts}`);
    
    try {
      // Implement retry mechanism for API calls
      const maxRetries = 3;
      let retryCount = 0;
      let responseData = null;

      while (retryCount < maxRetries && !responseData) {
        try {
          console.log(`Attempt ${retryCount + 1} to call OpenRouter API for narrative script...`);
          
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
                  content: `You are a professional storyteller and scriptwriter. Create an engaging narrative script based on the user's idea.
                  
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
                  
                  ${narrativePrompt}
                  
                  CRITICAL QUALITY REQUIREMENTS:
                  - Every sentence MUST be unique - DO NOT repeat sentences or phrases
                  - DO NOT use repetitive sentence structures
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
              max_tokens: 2500,
              temperature: 0.75,
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
      
      // Process the response
      let parsedContent;
      try {
        // Try to parse the content as JSON
        try {
          parsedContent = JSON.parse(content);
        } catch (initialParseError) {
          // Look for JSON content in the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          
          if (!jsonMatch) {
            throw new Error("Could not extract JSON from model response");
          }
          
          let jsonContent = jsonMatch[0];
          jsonContent = jsonContent.replace(/```json|```/g, "").trim();
          
          // Fix common JSON issues
          jsonContent = jsonContent.replace(/"script"\s*:\s*"((?:\\.|[^"\\])*)"/g, (match, p1) => {
            const escapedScript = p1.replace(/(?<!\\)"/g, '\\"');
            return `"script": "${escapedScript}"`;
          });
          
          parsedContent = JSON.parse(jsonContent);
        }
        
        // Validate response
        if (!parsedContent.script) {
          throw new Error("Missing script field in JSON response");
        }
        
      } catch (e) {
        console.error("JSON parse error:", e);
        
        // Try alternative extraction
        try {
          const scriptMatch = content.match(/"script"\s*:\s*"([^]*?)(?:"(?:\s*\}|\s*,))/);
          if (scriptMatch && scriptMatch[1]) {
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
          
          // Emergency fallback
          parsedContent = {
            script: "Sorry, there was an issue generating your narrative script. Please try again with a different prompt."
          };
        }
      }

      // Process script
      if (parsedContent.script) {
        parsedContent.script = parsedContent.script.replace(/\\n/g, "\n");
        
        // Clean script text
        parsedContent.script = cleanScriptText(parsedContent.script);
        
        // Check for duplicate sentences
        const duplicateCheck = checkForDuplicateSentences(parsedContent.script);
        
        if (duplicateCheck.hasDuplicates) {
          console.log(`Found ${duplicateCheck.duplicateCount} duplicate sentences in attempt ${generationAttempt}.`);
          continue;
        }
        
        // Check word count
        const originalWordCount = parsedContent.script.trim().split(/\s+/).length;
        console.log(`Original word count: ${originalWordCount}, Target: ${targetWordCount}-${maxWordCount}`);
        
        // Adjust word count if needed
        if (originalWordCount < minWordCount) {
          console.log(`Script is too short. Expanding to reach at least ${minWordCount} words.`);
          parsedContent.script = expandScript(parsedContent.script, minWordCount);
        } else if (originalWordCount > maxWordCount) {
          console.log(`Script is too long. Reducing to max ${maxWordCount} words.`);
          parsedContent.script = reduceScript(parsedContent.script, maxWordCount);
        }
        
        // If everything looks good, set final script
        finalScript = parsedContent.script;
      }
    } catch (error) {
      console.error(`Error in generation attempt ${generationAttempt}:`, error);
    }
  }
  
  // If all attempts failed
  if (!finalScript) {
    console.error("Failed to generate a narrative script after all attempts");
    return NextResponse.json(
      { error: "Could not generate a valid narrative script. Please try again with a different prompt." },
      { status: 500 }
    );
  }
  
  return NextResponse.json({ 
    script: finalScript,
    storyStructure
  }, { status: 200 });
}

// Returns the appropriate narrative structure prompt based on the requested structure
function getNarrativeStructurePrompt(storyStructure: string): string {
  const structures = {
    standard: `NARRATIVE STRUCTURE REQUIREMENTS - STANDARD THREE-ACT:
    - Follow the classic three-act structure:
      - Beginning (Act 1): Set up the situation, introduce main elements, and establish a hook
      - Middle (Act 2): Develop the central conflict or exploration with rising action
      - End (Act 3): Provide resolution and conclusion that ties back to the beginning
    - Ensure each act flows naturally into the next with clear but smooth transitions
    - Create a compelling narrative arc with rising tension and satisfying resolution
    - Begin with an engaging hook that draws the listener in immediately
    - End with a memorable conclusion that provides closure`,

    hero: `NARRATIVE STRUCTURE REQUIREMENTS - HERO'S JOURNEY:
    - Follow a simplified hero's journey structure:
      - Ordinary World: Establish the initial situation or status quo
      - Call to Adventure: Present a challenge, opportunity, or problem
      - Journey/Trials: Describe the process of facing obstacles and growth
      - Transformation: Show how the subject changes or what is discovered
      - Return/Resolution: Conclude with lessons learned and resolution
    - Create clear character development or transformation through the narrative
    - Focus on challenges and how they are overcome
    - Emphasize the emotional journey alongside factual content
    - End with a sense of growth, revelation, or change`,

    problem: `NARRATIVE STRUCTURE REQUIREMENTS - PROBLEM-SOLUTION:
    - Structure the narrative around a clear problem-solution framework:
      - Introduction: Present a compelling problem or challenge
      - Background: Provide context about why this problem matters
      - Complications: Explore the nuances or difficulties of the issue
      - Solution: Present the key insights or solutions
      - Implementation: Describe how these solutions can be applied
      - Results: Show the potential or actual outcomes
    - Begin by establishing why the listener should care about this problem
    - Create emotional investment in finding the solution
    - Build tension as the problem is explored before revealing solutions
    - End with clear takeaways or calls to action`,

    inverted: `NARRATIVE STRUCTURE REQUIREMENTS - INVERTED PYRAMID:
    - Structure the narrative like an inverted pyramid:
      - Start with the most important information or conclusion first
      - Follow with supporting details in decreasing order of importance
      - End with background or contextual information
    - Begin with a powerful summary that captures the key points
    - Each subsequent section should add depth rather than new critical information
    - Designed for information efficiency while maintaining narrative interest
    - Even with this structure, maintain a cohesive storyline throughout`,

    circular: `NARRATIVE STRUCTURE REQUIREMENTS - CIRCULAR NARRATIVE:
    - Structure the story to begin and end in the same place:
      - Opening: Start with a compelling scene, image, or statement
      - Background: Move to explain how we arrived at the opening
      - Journey: Progress through the main narrative exploration
      - Return: Circle back to the opening with new perspective or understanding
    - The opening and closing should mirror each other but with transformed understanding
    - Create a sense of completion and symmetry
    - The journey between start and end should provide discovery and insight
    - Ensure the return to the beginning feels meaningful rather than repetitive`
  };

  // Return the requested structure or default to standard if not found
  return structures[storyStructure as keyof typeof structures] || structures.standard;
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
  
  // Clean up any double spacing or extra line breaks
  cleanedScript = cleanedScript.replace(/\n{3,}/g, "\n\n").trim();
  
  return cleanedScript;
}

// Function to check for duplicate sentences in a script
function checkForDuplicateSentences(script: string) {
  // Split text into sentences
  const sentences = script.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
  
  // Map to store normalized sentences we've seen
  const sentenceMap = new Map();
  const duplicateSentences = [];
  
  // Process each sentence
  for (const sentence of sentences) {
    // Normalize the sentence
    const normalized = sentence.trim().toLowerCase().replace(/\s+/g, ' ');
    
    // Skip very short sentences
    if (normalized.split(/\s+/).length < 4) {
      continue;
    }
    
    // Check if we've seen this sentence before
    if (sentenceMap.has(normalized)) {
      duplicateSentences.push({
        sentence: sentence.trim(),
        firstPosition: sentenceMap.get(normalized),
        currentPosition: sentences.indexOf(sentence)
      });
    } else {
      sentenceMap.set(normalized, sentences.indexOf(sentence));
    }
  }
  
  return {
    hasDuplicates: duplicateSentences.length > 0,
    duplicateCount: duplicateSentences.length,
    duplicateSentences: duplicateSentences,
    sentenceMap: sentenceMap
  };
}

// Function to expand a script to meet minimum word count
function expandScript(script: string, targetWordCount: number): string {
  const currentWordCount = script.trim().split(/\s+/).length;
  
  if (currentWordCount >= targetWordCount) {
    return script; // Already meets the minimum
  }
  
  // Narrative expansion sentences grouped by where they might appear in the story
  const expansionSentences = {
    beginning: [
      "This story begins in a way that might seem familiar yet holds unexpected turns.",
      "The journey we're about to embark on has deeper significance than first appears.",
      "As our narrative unfolds, consider how these events connect to universal experiences.",
      "Before we delve deeper, it's worth considering the broader context.",
      "The setting of our story creates an atmosphere that shapes everything that follows."
    ],
    middle: [
      "This moment represents a turning point that changes the trajectory of events.",
      "The complexities of this situation reveal themselves in layers.",
      "What happens next challenges our initial expectations.",
      "Consider how these developments reflect a transformation taking place.",
      "The tension builds as we approach a critical moment of decision."
    ],
    end: [
      "As this story concludes, we're left with insights that resonate beyond the specific events.",
      "The resolution brings us full circle while revealing new understanding.",
      "What began as one journey has transformed into something more meaningful.",
      "The conclusion offers both closure and new possibilities to consider.",
      "Looking back at where we started, we can appreciate the significance of this journey."
    ]
  };
  
  // Split the script into paragraphs
  let paragraphs = script.split("\n\n");
  if (paragraphs.length === 1 && script.includes("\n")) {
    paragraphs = script.split("\n");
  }
  if (paragraphs.length === 0) {
    paragraphs = [script];
  }
  
  // Determine which part of the narrative each paragraph belongs to
  const totalParagraphs = paragraphs.length;
  const beginningEnd = Math.floor(totalParagraphs * 0.3);
  const middleEnd = Math.floor(totalParagraphs * 0.7);
  
  // Add expansion sentences to paragraphs until we reach the target word count
  let expandedScript = "";
  let currentCount = currentWordCount;
  
  for (let i = 0; i < paragraphs.length && currentCount < targetWordCount; i++) {
    // Add the original paragraph
    expandedScript += paragraphs[i];
    
    // Add expansion sentences if we still need more words
    if (currentCount < targetWordCount) {
      // Select appropriate expansion sentences based on narrative position
      let sentenceSet = expansionSentences.middle;
      if (i < beginningEnd) {
        sentenceSet = expansionSentences.beginning;
      } else if (i >= middleEnd) {
        sentenceSet = expansionSentences.end;
      }
      
      // Add one expansion sentence
      const sentenceIndex = i % sentenceSet.length;
      const sentenceToAdd = sentenceSet[sentenceIndex];
      expandedScript += " " + sentenceToAdd;
      currentCount += sentenceToAdd.split(/\s+/).length;
    }
    
    expandedScript += "\n\n";
  }
  
  // If we still need more words, add a concluding paragraph
  if (currentCount < targetWordCount) {
    expandedScript += "As we reflect on this narrative, we recognize themes that connect to our own experiences. The story's journey reminds us of the universal elements that bind all compelling tales: transformation, realization, and the continuous search for meaning in our shared human experience.\n\n";
    currentCount += 40; // Approximate word count of the added paragraph
  }
  
  return expandedScript.trim();
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
    truncatedText = truncatedText.substring(0, lastPeriodIndex + 1);
  }
  
  return truncatedText;
} 