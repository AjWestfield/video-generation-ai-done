import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface ImagePromptGenerationProps {
  script: string;
  onImagePromptsGenerated: (imageSections: any[]) => void;
  onBack: () => void;
}

const ImagePromptGeneration: React.FC<ImagePromptGenerationProps> = ({
  script,
  onImagePromptsGenerated,
  onBack,
}) => {
  const [loading, setLoading] = useState(false);
  const [imagePrompts, setImagePrompts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    generateImagePrompts();
  }, []);

  const generateImagePrompts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/openrouter/generate-image-prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ script }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate image prompts");
      }

      const data = await response.json();
      
      if (!data.imageSections || !Array.isArray(data.imageSections) || data.imageSections.length === 0) {
        if (retryCount < 2) {
          setRetryCount(prev => prev + 1);
          setLoading(false);
          toast.error("Retrying image prompt generation...");
          return generateImagePrompts();
        } else {
          // If we've retried too many times, create fallback prompts
          const fallbackPrompts = createFallbackPrompts(script);
          setImagePrompts(fallbackPrompts);
          toast.success("Used fallback image prompts");
          setLoading(false);
          return;
        }
      }
      
      setImagePrompts(data.imageSections);
    } catch (err) {
      console.error("Error generating image prompts:", err);
      setError((err as Error).message);
      toast.error("Failed to generate image prompts. Please try again.");
      
      // If we've had an error, create fallback prompts
      if (retryCount >= 1) {
        const fallbackPrompts = createFallbackPrompts(script);
        setImagePrompts(fallbackPrompts);
        setError(null);
        toast.success("Used fallback image prompts");
      }
    } finally {
      setLoading(false);
    }
  };

  // Create fallback prompts if the API fails
  const createFallbackPrompts = (script: string): any[] => {
    // Extract some keywords from the script
    const words = script.split(/\s+/);
    const keywords = words
      .filter(word => word.length > 4)
      .filter(word => !['about', 'these', 'those', 'their', 'there', 'would', 'could', 'should'].includes(word.toLowerCase()))
      .slice(0, 20);
    
    // Create some generic prompts with keywords from the script
    return [
      {
        scriptSection: "Introduction",
        imagePrompt: `A professional, high-quality image representing the introduction to ${keywords[0] || 'the topic'}. Detailed visualization with ${keywords[2] || 'relevant'} elements in a ${keywords[5] || 'clear'} composition.`
      },
      {
        scriptSection: "Main Point 1",
        imagePrompt: `Detailed illustration showing ${keywords[1] || 'the first main concept'} with ${keywords[7] || 'supporting'} visual elements. Professional quality, sharp focus, well-composed.`
      },
      {
        scriptSection: "Main Point 2",
        imagePrompt: `High-resolution image depicting ${keywords[3] || 'the second main idea'} with ${keywords[9] || 'key'} details. Clean background, professional lighting, engaging composition.`
      },
      {
        scriptSection: "Conclusion",
        imagePrompt: `Conclusive visual representation summarizing ${keywords[4] || 'the topic'} with ${keywords[8] || 'essential'} elements. Professional, clear, and impactful imagery.`
      }
    ];
  };

  const handleContinue = () => {
    if (imagePrompts.length > 0) {
      onImagePromptsGenerated(imagePrompts);
    }
  };

  const handleRegeneratePrompts = () => {
    setRetryCount(0);
    generateImagePrompts();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Generating Image Prompts</h2>
          <p className="text-gray-400 mt-2">
            Our AI is creating visual prompts based on your script...
          </p>
          {retryCount > 0 && (
            <p className="text-yellow-500 mt-1">Retry attempt: {retryCount}/2</p>
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
            onClick={handleRegeneratePrompts}
            className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Your Image Prompts</h2>
        <p className="text-gray-400 mt-2">
          Review the image prompts generated by AI. You can proceed or regenerate them.
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
        <h3 className="text-xl font-medium text-white mb-3">Image Prompts:</h3>
        <div className="space-y-4">
          {imagePrompts.map((section, i) => (
            <div
              key={i}
              className="bg-gray-800 p-3 rounded border border-gray-700"
            >
              <p className="text-sm text-gray-400 mb-1">Section:</p>
              <p className="text-gray-300 mb-2">{section.scriptSection}</p>
              <p className="text-sm text-gray-400 mb-1">Image Prompt:</p>
              <p className="text-gray-300">{section.imagePrompt}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-2 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleRegeneratePrompts}
          className="flex-1 py-2 px-4 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700 transition-colors"
        >
          Regenerate
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default ImagePromptGeneration; 