import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface ScriptGenerationProps {
  videoIdea: string;
  videoDuration: number;
  onScriptGenerated: (scriptData: any) => void;
  onBack: () => void;
}

const ScriptGeneration: React.FC<ScriptGenerationProps> = ({
  videoIdea,
  videoDuration,
  onScriptGenerated,
  onBack,
}) => {
  const [loading, setLoading] = useState(false);
  const [scriptData, setScriptData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [autoRetrying, setAutoRetrying] = useState(false);
  const [editableScript, setEditableScript] = useState<string>("");
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    generateScript();
  }, []);

  useEffect(() => {
    // Update editable script when scriptData changes
    if (scriptData?.script) {
      setEditableScript(scriptData.script);
    }
  }, [scriptData]);

  const generateScript = async () => {
    setLoading(true);
    setError(null);
    setAutoRetrying(false);

    try {
      const response = await fetch("/api/openrouter/generate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          prompt: videoIdea,
          duration: videoDuration 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate script");
      }

      const data = await response.json();
      
      // Check if we got a valid script
      if (!data.script || data.script === "Sorry, there was an issue generating your script. Please try again with a different prompt.") {
        if (retryCount < 2) {
          setRetryCount(prev => prev + 1);
          setLoading(false);
          toast.error("Retrying script generation...");
          return generateScript();
        } else {
          // If we've retried too many times, create a minimal valid script
          const fallbackScript = createFallbackScript(videoIdea, videoDuration);
          setScriptData({ script: fallbackScript });
          setWordCount(fallbackScript.split(/\s+/).length);
          toast.success("Used fallback script generation");
          setLoading(false);
          return;
        }
      }
      
      setScriptData(data);
      
      // Calculate word count
      if (data.script) {
        const words = data.script.trim().split(/\s+/).length;
        setWordCount(words);
        
        const targetWordCount = videoDuration * 180;
        
        // If the word count is severely below target (less than 50%), auto-retry
        if (words < targetWordCount * 0.5 && retryCount < 2) {
          setRetryCount(prev => prev + 1);
          setAutoRetrying(true);
          toast.error(`Script is too short (${words} words). Auto-retrying...`);
          setTimeout(() => {
            generateScript();
          }, 1000);
          return;
        }
      }
    } catch (err) {
      console.error("Error generating script:", err);
      setError((err as Error).message);
      toast.error("Failed to generate script. Please try again.");
      
      // If we've had an error, create a fallback script
      if (retryCount >= 1) {
        const fallbackScript = createFallbackScript(videoIdea, videoDuration);
        setScriptData({ script: fallbackScript });
        setWordCount(fallbackScript.split(/\s+/).length);
        setError(null);
        toast.success("Used fallback script generation");
      }
    } finally {
      if (!autoRetrying) {
        setLoading(false);
      }
    }
  };

  // Create a simple fallback script if the API fails
  const createFallbackScript = (idea: string, duration: number): string => {
    const targetWords = duration * 180;
    const sentences = [
      `Welcome to this video about ${idea}.`,
      `Today we'll explore this fascinating topic in detail.`,
      `${idea} is becoming increasingly important in our daily lives.`,
      `Let's examine what makes ${idea} so interesting.`,
      `There are several key aspects to consider when discussing ${idea}.`,
      `First, we need to understand the basics.`,
      `The concept has evolved significantly over time.`,
      `Experts in the field have different perspectives on ${idea}.`,
      `Research shows some surprising findings about this topic.`,
      `Many people don't realize how ${idea} affects them every day.`,
      `Consider how this relates to your own experiences.`,
      `The implications of ${idea} extend far beyond what most people think.`,
      `Looking ahead, we can expect to see continued developments in this area.`,
      `The future of ${idea} holds exciting possibilities.`,
      `Thank you for watching this exploration of ${idea}.`,
      `I hope you found this information valuable and insightful.`
    ];
    
    // Repeat sentences until we reach target word count
    let script = "";
    while (script.split(/\s+/).length < targetWords) {
      sentences.forEach(sentence => {
        if (script.split(/\s+/).length < targetWords) {
          script += sentence + " ";
        }
      });
    }
    
    return script.trim();
  };

  const handleContinue = () => {
    if (editMode) {
      // If in edit mode, update the script data with edited content
      const updatedScriptData = { ...scriptData, script: editableScript };
      setScriptData(updatedScriptData);
      
      // Update word count
      const words = editableScript.trim().split(/\s+/).length;
      setWordCount(words);
      
      // Exit edit mode
      setEditMode(false);
      
      // Continue with updated script
      onScriptGenerated(updatedScriptData);
    } else {
      if (scriptData) {
        // Confirm the script meets minimum requirements
        const targetWordCount = videoDuration * 180;
        const minWordCount = targetWordCount;
        const currentWordCount = scriptData.script.trim().split(/\s+/).length;
        
        if (currentWordCount < minWordCount * 0.9) {
          // If significantly below target, warn user
          if (!window.confirm(`This script is short (${currentWordCount} words vs. target ${minWordCount}). The server should have expanded it, but it appears there might be an issue. Continue anyway?`)) {
            return;
          }
        }
        
        onScriptGenerated(scriptData);
      }
    }
  };

  const handleRegenerateScript = () => {
    setRetryCount(0);
    setEditMode(false);
    generateScript();
  };

  const handleEditToggle = () => {
    if (editMode) {
      // Switching from edit mode to view mode
      // Update script data and recalculate word count
      const updatedScriptData = { ...scriptData, script: editableScript };
      setScriptData(updatedScriptData);
      setWordCount(editableScript.trim().split(/\s+/).length);
      toast.success("Script updated");
    }
    setEditMode(!editMode);
  };

  const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableScript(e.target.value);
    // Update word count in real time
    setWordCount(e.target.value.trim().split(/\s+/).length);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[rgba(var(--accent-cyan),1)] to-[rgba(var(--accent-blue),1)] text-glow">
            Generating Script
          </h2>
          <p className="text-gray-300 mt-1 text-sm">
            Our AI is creating an engaging {videoDuration}-minute script based on your idea...
          </p>
          {retryCount > 0 && (
            <p className={`text-[rgba(var(--accent-cyan),0.9)] mt-1 text-sm ${autoRetrying ? 'animate-pulse' : ''}`}>
              {autoRetrying ? 'Auto-retrying: ' : 'Retry attempt: '}{retryCount}/2
            </p>
          )}
        </div>

        <div className="flex justify-center my-4">
          <div className="flex space-x-4">
            <div className="h-10 w-10 bg-[rgba(var(--accent-blue),0.8)] rounded-full animate-bounce"></div>
            <div className="h-10 w-10 bg-[rgba(var(--accent-cyan),0.8)] rounded-full animate-bounce animation-delay-200"></div>
            <div className="h-10 w-10 bg-[rgba(var(--accent-purple),0.8)] rounded-full animate-bounce animation-delay-400"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 text-glow">Error</h2>
          <p className="text-red-400 mt-2 text-sm">{error}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-2 px-3 bg-[rgba(60,70,85,0.8)] text-white text-sm font-medium rounded-lg hover:bg-[rgba(70,80,95,0.9)] transition-all duration-300"
          >
            Back
          </button>
          <button
            onClick={handleRegenerateScript}
            className="flex-1 py-2 px-3 bg-[rgba(var(--accent-blue),0.8)] text-white text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-blue),1)] transition-all duration-300 button-glow"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!scriptData) return null;

  // Calculate target word count and bounds
  const targetWordCount = videoDuration * 180; // 180 words per minute
  const minWordCount = targetWordCount;
  const maxWordCount = Math.floor(targetWordCount * 1.15);
  
  // Determine if word count is within acceptable bounds
  let wordCountClass = "text-[rgba(80,230,180,1)]"; // Good - green cyan
  let wordCountMessage = "Perfect length for a";
  
  if (wordCount && wordCount < minWordCount * 0.95) {
    wordCountClass = "text-red-400 font-medium";
    wordCountMessage = "Too short for a";
  } else if (wordCount && wordCount < minWordCount) {
    wordCountClass = "text-[rgba(var(--accent-cyan),0.9)]";
    wordCountMessage = "Slightly short for a";
  } else if (wordCount && wordCount > maxWordCount) {
    wordCountClass = "text-[rgba(var(--accent-purple),0.9)]";
    wordCountMessage = "Slightly long for a";
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[rgba(var(--accent-cyan),1)] to-[rgba(var(--accent-blue),1)] text-glow">
          Your Video Script
        </h2>
        <p className="text-gray-300 mt-1 text-xs md:text-sm">
          Review the script generated by AI. You can proceed, edit, or regenerate it.
        </p>
        {wordCount && (
          <div>
            <p className={`text-xs md:text-sm mt-1 ${wordCountClass}`}>
              Word count: {wordCount} / Target: {targetWordCount}-{maxWordCount} words
            </p>
            <p className={`text-xs md:text-sm ${wordCountClass}`}>
              ({wordCountMessage} {videoDuration}-minute video)
            </p>
            {wordCount < minWordCount && !editMode && (
              <p className="text-red-400 text-xs mt-1 max-w-md mx-auto">
                Note: The script is shorter than ideal. You can edit the script to add more content.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-glass-darker rounded-lg p-3 md:p-4 border border-[rgba(var(--accent-blue),0.2)] box-glow relative h-72 md:h-80 overflow-y-auto">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.3)] to-transparent"></div>
        {editMode ? (
          <textarea
            value={editableScript}
            onChange={handleScriptChange}
            className="w-full h-full bg-[rgba(15,20,35,0.5)] text-gray-200 p-2 rounded-md border border-[rgba(var(--accent-blue),0.3)] focus:border-[rgba(var(--accent-cyan),0.8)] focus:ring-1 focus:ring-[rgba(var(--accent-cyan),0.5)] focus:outline-none custom-scrollbar"
            placeholder="Edit your script here..."
          />
        ) : (
          <div className="prose prose-invert max-w-none text-gray-200 h-full custom-scrollbar">
            {scriptData.script.split("\n").map((paragraph: string, i: number) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onBack}
          className="py-2 px-3 bg-[rgba(60,70,85,0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(70,80,95,0.9)] transition-all duration-300"
        >
          Back
        </button>
        <button
          onClick={handleEditToggle}
          className={`py-2 px-3 text-white text-xs md:text-sm font-medium rounded-lg transition-all duration-300 button-glow ${
            editMode 
              ? 'bg-[rgba(0,180,120,0.8)] hover:bg-[rgba(0,200,140,0.9)]' 
              : 'bg-[rgba(var(--accent-purple),0.8)] hover:bg-[rgba(var(--accent-purple),0.9)]'
          }`}
        >
          {editMode ? 'Save Edits' : 'Edit Script'}
        </button>
        <button
          onClick={handleRegenerateScript}
          className="py-2 px-3 bg-[rgba(var(--accent-cyan),0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-cyan),0.9)] transition-all duration-300 button-glow"
        >
          Regenerate
        </button>
        <button
          onClick={handleContinue}
          className="py-2 px-3 bg-[rgba(var(--accent-blue),0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-blue),1)] transition-all duration-300 button-glow"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default ScriptGeneration; 