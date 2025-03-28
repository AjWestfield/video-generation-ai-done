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
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Generating Script</h2>
          <p className="text-gray-400 mt-2">
            Our AI is creating an engaging {videoDuration}-minute script based on your idea...
          </p>
          {retryCount > 0 && (
            <p className={`text-yellow-500 mt-1 ${autoRetrying ? 'animate-pulse' : ''}`}>
              {autoRetrying ? 'Auto-retrying: ' : 'Retry attempt: '}{retryCount}/2
            </p>
          )}
        </div>

        <div className="flex justify-center my-8">
          <div className="animate-pulse flex space-x-4">
            <div className="h-12 w-12 bg-blue-600 rounded-full animate-bounce"></div>
            <div className="h-12 w-12 bg-indigo-600 rounded-full animate-bounce animation-delay-200"></div>
            <div className="h-12 w-12 bg-purple-600 rounded-full animate-bounce animation-delay-400"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Error</h2>
          <p className="text-red-500 mt-2">{error}</p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 py-2 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleRegenerateScript}
            className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
  let wordCountClass = "text-green-500"; // Default - good
  let wordCountMessage = "Perfect length for a";
  
  if (wordCount && wordCount < minWordCount * 0.95) {
    wordCountClass = "text-red-500 font-bold";
    wordCountMessage = "Too short for a";
  } else if (wordCount && wordCount < minWordCount) {
    wordCountClass = "text-yellow-500";
    wordCountMessage = "Slightly short for a";
  } else if (wordCount && wordCount > maxWordCount) {
    wordCountClass = "text-yellow-500";
    wordCountMessage = "Slightly long for a";
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Your Video Script</h2>
        <p className="text-gray-400 mt-2">
          Review the script generated by AI. You can proceed, edit, or regenerate it.
        </p>
        {wordCount && (
          <div>
            <p className={`text-sm mt-1 ${wordCountClass}`}>
              Word count: {wordCount} / Target: {targetWordCount}-{maxWordCount} words
            </p>
            <p className={`text-sm ${wordCountClass}`}>
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

      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 h-80 overflow-y-auto">
        {editMode ? (
          <textarea
            value={editableScript}
            onChange={handleScriptChange}
            className="w-full h-full bg-gray-800 text-gray-300 p-2 rounded-md border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="Edit your script here..."
          />
        ) : (
          <div className="prose prose-invert max-w-none text-gray-300 h-full">
            {scriptData.script.split("\n").map((paragraph: string, i: number) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-wrap">
        <button
          onClick={onBack}
          className="py-2 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleEditToggle}
          className={`py-2 px-4 ${editMode ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'} text-white font-medium rounded-lg transition-colors`}
        >
          {editMode ? 'Save Edits' : 'Edit Script'}
        </button>
        <button
          onClick={handleRegenerateScript}
          className="py-2 px-4 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700 transition-colors"
        >
          Regenerate
        </button>
        <button
          onClick={handleContinue}
          className="py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default ScriptGeneration; 