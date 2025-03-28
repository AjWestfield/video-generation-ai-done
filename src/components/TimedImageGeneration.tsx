import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";

// Toast manager to prevent multiple toasts
const toastIds = {
  current: null as string | null
};

// Centralized toast handler
const showToast = (message: string, type: 'success' | 'error' | 'loading') => {
  // Dismiss any existing toast first
  if (toastIds.current) {
    toast.dismiss(toastIds.current);
  }
  
  // Show the new toast and store its ID
  if (type === 'success') {
    toastIds.current = toast.success(message).toString();
  } else if (type === 'error') {
    toastIds.current = toast.error(message).toString();
  } else if (type === 'loading') {
    toastIds.current = toast.loading(message).toString();
  }
  
  return toastIds.current;
};

interface TimedImageGenerationProps {
  script: string;
  audioBase64: string;
  onImagesGenerated: (images: { timestamp: number; imageBase64: string }[]) => void;
  onBack: () => void;
}

const TimedImageGeneration: React.FC<TimedImageGenerationProps> = ({
  script,
  audioBase64,
  onImagesGenerated,
  onBack,
}) => {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(true);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [imagePrompts, setImagePrompts] = useState<{ timestamp: number; prompt: string }[]>([]);
  const [generatedImages, setGeneratedImages] = useState<{ timestamp: number; imageBase64: string }[]>([]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState(4); // Default interval in seconds

  // Calculate how many images will be generated
  const totalImages = imagePrompts.length;
  const progress = totalImages > 0 ? Math.round((generatedImages.length / totalImages) * 100) : 0;

  // Analyze audio duration when component mounts
  useEffect(() => {
    if (audioBase64) {
      analyzeAudioDuration();
    }
  }, [audioBase64]);

  // Generate prompts when audio duration is known
  useEffect(() => {
    if (audioDuration !== null) {
      generateTimedPrompts();
    }
  }, [audioDuration, interval]);

  // Generate images when prompts are ready
  useEffect(() => {
    if (imagePrompts.length > 0 && generatedImages.length === 0) {
      generateImages();
    }
  }, [imagePrompts]);

  const analyzeAudioDuration = () => {
    setAnalyzing(true);
    try {
      // Create an audio element to get duration
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      
      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration;
        setAudioDuration(duration);
        setAnalyzing(false);
        showToast(`Audio duration: ${Math.round(duration)} seconds`, 'success');
      });
      
      audio.addEventListener('error', (e) => {
        console.error("Audio loading error:", e);
        setError("Failed to analyze audio duration");
        setAnalyzing(false);
        showToast("Failed to analyze audio duration", 'error');
      });
    } catch (err) {
      console.error("Error analyzing audio:", err);
      setError("Failed to analyze audio duration");
      setAnalyzing(false);
      showToast("Failed to analyze audio duration", 'error');
    }
  };

  const generateTimedPrompts = async () => {
    if (!audioDuration) return;
    
    setLoading(true);
    setError(null);
    
    const loadingToastId = showToast("Generating image prompts...", 'loading');

    try {
      const response = await fetch("/api/openrouter/generate-timed-image-prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          script,
          audioDuration,
          interval,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate image prompts");
      }

      const data = await response.json();
      
      if (!data.imagePrompts || !Array.isArray(data.imagePrompts) || data.imagePrompts.length === 0) {
        throw new Error("No image prompts generated");
      }
      
      setImagePrompts(data.imagePrompts);
      setLoading(false);
      toast.dismiss(loadingToastId);
      showToast("Image prompts generated successfully", 'success');
    } catch (err) {
      console.error("Error generating prompts:", err);
      setError((err as Error).message);
      setLoading(false);
      toast.dismiss(loadingToastId);
      showToast(`Failed to generate image prompts: ${(err as Error).message}`, 'error');
    }
  };

  const generateImages = async () => {
    if (imagePrompts.length === 0) return;
    
    setLoading(true);
    setError(null);
    setGeneratedImages([]);  // Reset any previously generated images
    setCurrentPromptIndex(0);

    // Process all prompts with no limit
    const promptsToGenerate = imagePrompts;
    
    // Show initial loading toast
    const loadingToastId = showToast(`Generating images: 0/${promptsToGenerate.length}`, 'loading');
    let lastToastUpdateTime = Date.now();
    
    try {
      // Process each prompt sequentially
      for (let i = 0; i < promptsToGenerate.length; i++) {
        // Process one prompt at a time
        const currentPrompt = promptsToGenerate[i];
        setCurrentPromptIndex(i);
        
        // Update toast message periodically but not too frequently
        const now = Date.now();
        if (now - lastToastUpdateTime > 1500) { // Update at most every 1.5 seconds
          toast.dismiss(loadingToastId);
          showToast(`Generating images: ${i+1}/${promptsToGenerate.length}`, 'loading');
          lastToastUpdateTime = now;
        }
        
        try {
          const response = await fetch("/api/replicate/generate-timed-images", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompts: [currentPrompt],
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error(`Error generating image ${i+1}/${promptsToGenerate.length}:`, errorData);
            // Don't show toast for individual image errors to avoid clutter
            // Continue with next image instead of stopping completely
            continue;
          }

          const data = await response.json();
          
          if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
            console.error(`No results for image ${i+1}/${promptsToGenerate.length}`);
            continue;
          }
          
          // Add the new images to our generated images array
          setGeneratedImages(prev => [
            ...prev,
            ...data.results.map((result: any) => ({
              timestamp: result.timestamp,
              imageBase64: result.imageBase64,
            }))
          ]);
          
          // Small delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (err) {
          console.error(`Error with image ${i+1}/${promptsToGenerate.length}:`, err);
          // Continue with next image instead of stopping completely
          continue;
        }
      }
      
      // Get the final count of generated images after all processing is done
      setGeneratedImages(prev => {
        // Now we can safely check if we have generated any images
        const finalGeneratedCount = prev.length;
        
        setLoading(false);
        toast.dismiss(loadingToastId);
        
        if (finalGeneratedCount === 0) {
          setError("Failed to generate any images. Please try again.");
          showToast("Failed to generate any images. Please try again.", 'error');
        } else if (finalGeneratedCount < promptsToGenerate.length) {
          setError(null); // Clear any error when we have at least some images
          showToast(`Generated ${finalGeneratedCount} of ${promptsToGenerate.length} images.`, 'success');
        } else {
          setError(null); // Clear any error when all images are generated
          showToast("All images generated successfully!", 'success');
        }
        
        return prev; // Return unmodified state
      });
      
    } catch (err) {
      console.error("Error generating images:", err);
      setError((err as Error).message);
      setLoading(false);
      toast.dismiss(loadingToastId);
      showToast(`Failed to generate images: ${(err as Error).message}`, 'error');
    }
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInterval = parseFloat(e.target.value);
    if (newInterval >= 3 && newInterval <= 10) {
      setInterval(newInterval);
    }
  };

  const handleRegeneratePrompts = () => {
    setImagePrompts([]);
    setGeneratedImages([]);
    setCurrentPromptIndex(0);
    generateTimedPrompts();
  };

  const handleRegenerateImages = () => {
    setGeneratedImages([]);
    setCurrentPromptIndex(0);
    generateImages();
  };

  const handleContinue = () => {
    if (generatedImages.length > 0) {
      // Sort images by timestamp before continuing
      const sortedImages = [...generatedImages].sort((a, b) => a.timestamp - b.timestamp);
      onImagesGenerated(sortedImages);
    } else {
      showToast("Please wait for images to be generated", 'error');
    }
  };

  const formatTimestamp = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  if (analyzing) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Analyzing Audio</h2>
          <p className="text-gray-400 mt-2">
            Analyzing audio duration for timed image generation...
          </p>
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

  if (loading && imagePrompts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Generating Image Prompts</h2>
          <p className="text-gray-400 mt-2">
            Creating contextual image prompts for your voiceover...
          </p>
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Timed Image Generation</h2>
        <p className="text-gray-400 mt-2">
          Generating images synchronized with your voiceover
          {audioDuration ? ` (${Math.round(audioDuration)} seconds)` : ""}
        </p>
      </div>

      {/* Interval selector */}
      {imagePrompts.length === 0 && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <div className="flex flex-col space-y-2">
            <label htmlFor="interval" className="text-white">
              Image interval: {interval} seconds
            </label>
            <input
              type="range"
              id="interval"
              min="3"
              max="10"
              step="0.5"
              value={interval}
              onChange={handleIntervalChange}
              className="w-full"
            />
            <p className="text-sm text-gray-400">
              This will generate approximately {audioDuration ? Math.ceil(audioDuration / interval) : "..."} images for your {audioDuration ? Math.round(audioDuration) : "..."} second voiceover.
            </p>
          </div>
          <div className="mt-4">
            <button
              onClick={generateTimedPrompts}
              className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              disabled={!audioDuration || loading}
            >
              Generate Image Prompts
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {(imagePrompts.length > 0 && generatedImages.length < totalImages) && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Generating image {generatedImages.length + 1} of {totalImages}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-center text-red-500 p-3 bg-red-900/20 border border-red-900 rounded-lg">
          {error}
        </div>
      )}

      {/* Prompts display */}
      {imagePrompts.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <h3 className="text-xl font-medium text-white mb-3">Generated Prompts:</h3>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {imagePrompts.map((prompt, index) => (
              <div
                key={index}
                className={`p-3 rounded border ${
                  index < generatedImages.length
                    ? "bg-green-900/20 border-green-700"
                    : index === currentPromptIndex && loading
                    ? "bg-blue-900/20 border-blue-700 animate-pulse"
                    : "bg-gray-800 border-gray-700"
                }`}
              >
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">
                    Timestamp: {formatTimestamp(prompt.timestamp)}
                  </span>
                  <span className="text-sm text-gray-400">
                    {index < generatedImages.length
                      ? "Generated"
                      : index === currentPromptIndex && loading
                      ? "Generating..."
                      : "Pending"}
                  </span>
                </div>
                <p className="text-gray-300 mt-1">{prompt.prompt}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated images display */}
      {generatedImages.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <h3 className="text-xl font-medium text-white mb-3">Generated Images:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {generatedImages.map((image, index) => (
              <div key={index} className="space-y-2">
                <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                  <img
                    src={image.imageBase64}
                    alt={`Generated image at ${formatTimestamp(image.timestamp)}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-sm text-gray-400 text-center">
                  Timestamp: {formatTimestamp(image.timestamp)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-2 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
        >
          Back
        </button>
        
        {imagePrompts.length > 0 && (
          <button
            onClick={handleRegeneratePrompts}
            className="flex-1 py-2 px-4 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700 transition-colors"
            disabled={loading}
          >
            Regenerate Prompts
          </button>
        )}
        
        {imagePrompts.length > 0 && generatedImages.length > 0 && (
          <button
            onClick={handleRegenerateImages}
            className="flex-1 py-2 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            disabled={loading}
          >
            Regenerate Images
          </button>
        )}
        
        <button
          onClick={handleContinue}
          className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          disabled={loading || generatedImages.length === 0}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default TimedImageGeneration; 