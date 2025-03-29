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

interface FocusImageType {
  imageBase64: string;
  timestamp: number;
  prompt: string;
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
  const [focusImage, setFocusImage] = useState<FocusImageType | null>(null);

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

  // Handle escape key to close focus view
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFocusImage(null);
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

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
  
  const handleImageClick = (image: { timestamp: number; imageBase64: string }, index: number) => {
    // Find the corresponding prompt for this timestamp
    const prompt = imagePrompts.find(p => p.timestamp === image.timestamp);
    
    if (prompt) {
      setFocusImage({
        imageBase64: image.imageBase64,
        timestamp: image.timestamp,
        prompt: prompt.prompt
      });
    }
  };

  if (analyzing) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white text-glow">Analyzing Audio</h2>
          <p className="text-gray-300 mt-1 text-sm">
            Analyzing audio duration for timed image generation...
          </p>
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

  if (loading && imagePrompts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white text-glow">Generating Image Prompts</h2>
          <p className="text-gray-300 mt-1 text-sm">
            Creating contextual image prompts for your voiceover...
          </p>
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

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="text-center">
        <h2 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[rgba(var(--accent-cyan),1)] to-[rgba(var(--accent-blue),1)] text-glow">
          Timed Image Generation
        </h2>
        <p className="text-gray-300 mt-1 text-xs md:text-sm">
          Generating images synchronized with your voiceover
          {audioDuration ? ` (${Math.round(audioDuration)} seconds)` : ""}
        </p>
      </div>

      {/* Interval selector */}
      {imagePrompts.length === 0 && (
        <div className="bg-glass-darker rounded-lg p-3 md:p-4 border border-[rgba(var(--accent-blue),0.2)] box-glow relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.3)] to-transparent"></div>
          <div className="flex flex-col space-y-2">
            <label htmlFor="interval" className="text-white text-sm">
              Image interval: <span className="text-[rgba(var(--accent-cyan),1)]">{interval} seconds</span>
            </label>
            <input
              type="range"
              id="interval"
              min="3"
              max="10"
              step="0.5"
              value={interval}
              onChange={handleIntervalChange}
              className="w-full accent-[rgba(var(--accent-cyan),1)]"
            />
            <p className="text-xs text-gray-300">
              This will generate approximately <span className="text-[rgba(var(--accent-cyan),1)]">{audioDuration ? Math.ceil(audioDuration / interval) : "..."}</span> images for your <span className="text-[rgba(var(--accent-blue),1)]">{audioDuration ? Math.round(audioDuration) : "..."}</span> second voiceover.
            </p>
          </div>
          <div className="mt-3">
            <button
              onClick={generateTimedPrompts}
              className="w-full py-2 px-3 bg-[rgba(var(--accent-blue),0.8)] text-white text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-blue),1)] transition-all duration-300 button-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[rgba(var(--accent-blue),0.8)]"
              disabled={!audioDuration || loading}
            >
              Generate Image Prompts
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {(imagePrompts.length > 0 && generatedImages.length < totalImages) && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-300">
            <span>Generating image {generatedImages.length + 1} of {totalImages}</span>
            <span className="text-[rgba(var(--accent-cyan),1)]">{progress}%</span>
          </div>
          <div className="w-full bg-[rgba(20,25,40,0.6)] rounded-full h-2 overflow-hidden backdrop-blur-sm box-glow">
            <div
              className="bg-gradient-to-r from-[rgba(var(--accent-blue),0.9)] to-[rgba(var(--accent-cyan),0.9)] h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-center text-red-400 p-2 bg-red-900/20 border border-red-800/50 rounded-lg text-xs md:text-sm">
          {error}
        </div>
      )}

      {/* Generated Prompts & Images Section - Compact Layout */}
      {imagePrompts.length > 0 && (
        <div className="max-w-[calc(100vw-2rem)] mx-auto">
          {/* Left column - Generated Prompts (visible on small screens, hidden on md and up) */}
          <div className="md:hidden">
            <div className="bg-glass-darker rounded-lg p-3 border border-[rgba(var(--accent-blue),0.2)] box-glow relative mb-2">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.3)] to-transparent"></div>
              <h3 className="text-base font-medium text-transparent bg-clip-text bg-gradient-to-r from-white to-[rgba(var(--accent-blue),1)]">Generated Prompts:</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar mt-2">
                {imagePrompts.map((prompt, index) => (
                  <div
                    key={index}
                    className={`p-1.5 rounded-lg border backdrop-blur-sm transition-all duration-300 text-xs ${
                      index < generatedImages.length
                        ? "bg-[rgba(0,100,80,0.2)] border-[rgba(80,230,180,0.4)]"
                        : index === currentPromptIndex && loading
                        ? "bg-[rgba(20,80,170,0.2)] border-[rgba(100,160,255,0.4)] animate-pulse"
                        : "bg-[rgba(20,25,40,0.5)] border-[rgba(var(--accent-blue),0.2)]"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[rgba(var(--accent-cyan),1)] font-mono">
                        {formatTimestamp(prompt.timestamp)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        index < generatedImages.length
                          ? "bg-[rgba(0,100,80,0.2)] text-[rgba(120,255,200,1)]"
                          : index === currentPromptIndex && loading
                          ? "bg-[rgba(20,80,170,0.2)] text-[rgba(100,160,255,1)] animate-pulse"
                          : "bg-[rgba(40,45,60,0.5)] text-gray-400"
                      }`}>
                        {index < generatedImages.length
                          ? "Generated"
                          : index === currentPromptIndex && loading
                          ? "Generating..."
                          : "Pending"}
                      </span>
                    </div>
                    <p className="text-gray-200 mt-0.5 line-clamp-1">{prompt.prompt}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Generated Images Grid - Wider and larger images */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {generatedImages.length > 0 && generatedImages.map((image, index) => {
              // Find the corresponding prompt for this timestamp
              const prompt = imagePrompts.find(p => p.timestamp === image.timestamp);
              return (
                <div key={index} className="group">
                  <div 
                    className="aspect-video bg-[rgba(20,25,40,0.5)] rounded-md overflow-hidden border border-[rgba(var(--accent-blue),0.3)] hover:border-[rgba(var(--accent-cyan),0.6)] transition-all duration-300 hover:shadow-lg cursor-pointer"
                    onClick={() => handleImageClick(image, index)}
                  >
                    <img
                      src={image.imageBase64}
                      alt={`Generated image at ${formatTimestamp(image.timestamp)}`}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    <div className="absolute bottom-1 left-1 text-[10px] bg-[rgba(0,0,0,0.5)] text-[rgba(var(--accent-cyan),1)] px-1.5 py-0.5 rounded-full backdrop-blur-sm font-mono">
                      {formatTimestamp(image.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Focus view modal - Updated layout to avoid scrolling */}
      {focusImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setFocusImage(null)}
        >
          <div 
            className="bg-glass-darker rounded-xl border border-[rgba(var(--accent-blue),0.3)] box-glow w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile view - stacked layout */}
            <div className="md:hidden flex flex-col h-full">
              <div className="p-3 border-b border-[rgba(var(--accent-blue),0.2)] flex justify-between items-center">
                <h3 className="text-base font-medium text-[rgba(var(--accent-cyan),1)]">
                  Image at {formatTimestamp(focusImage.timestamp)}
                </h3>
                <button 
                  className="text-gray-400 hover:text-white"
                  onClick={() => setFocusImage(null)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden bg-black">
                <img 
                  src={focusImage.imageBase64} 
                  alt={`Focus view at ${formatTimestamp(focusImage.timestamp)}`}
                  className="w-full h-auto object-contain max-h-[50vh]"
                />
              </div>
              <div className="p-3 border-t border-[rgba(var(--accent-blue),0.2)] bg-[rgba(15,20,30,0.5)] overflow-y-auto max-h-[40vh]">
                <h4 className="text-sm font-medium text-[rgba(var(--accent-cyan),0.9)] mb-1">Prompt:</h4>
                <p className="text-sm text-gray-300">{focusImage.prompt}</p>
              </div>
            </div>
            
            {/* Desktop view - side-by-side layout */}
            <div className="hidden md:flex md:flex-row h-full w-full">
              {/* Left side - Image */}
              <div className="w-7/12 bg-black flex items-center justify-center relative">
                <button 
                  className="absolute top-3 right-3 text-gray-400 hover:text-white z-10"
                  onClick={() => setFocusImage(null)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <img 
                  src={focusImage.imageBase64} 
                  alt={`Focus view at ${formatTimestamp(focusImage.timestamp)}`}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              </div>
              
              {/* Right side - Prompt details */}
              <div className="w-5/12 flex flex-col bg-[rgba(15,20,30,0.8)] border-l border-[rgba(var(--accent-blue),0.2)]">
                <div className="p-4 border-b border-[rgba(var(--accent-blue),0.2)]">
                  <h3 className="text-lg font-medium text-[rgba(var(--accent-cyan),1)]">
                    Image at {formatTimestamp(focusImage.timestamp)}
                  </h3>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                  <h4 className="text-sm font-medium text-[rgba(var(--accent-cyan),0.9)] mb-2">Prompt:</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">{focusImage.prompt}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-2 px-3 bg-[rgba(60,70,85,0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(70,80,95,0.9)] transition-all duration-300"
        >
          Back
        </button>
        
        {imagePrompts.length > 0 && (
          <button
            onClick={handleRegeneratePrompts}
            className="flex-1 py-2 px-3 bg-[rgba(var(--accent-purple),0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-purple),0.9)] transition-all duration-300 button-glow disabled:opacity-50"
            disabled={loading}
          >
            Regenerate Prompts
          </button>
        )}
        
        {imagePrompts.length > 0 && generatedImages.length > 0 && (
          <button
            onClick={handleRegenerateImages}
            className="flex-1 py-2 px-3 bg-[rgba(var(--accent-cyan),0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-cyan),0.9)] transition-all duration-300 button-glow disabled:opacity-50"
            disabled={loading}
          >
            Regenerate Images
          </button>
        )}
        
        <button
          onClick={handleContinue}
          className="flex-1 py-2 px-3 bg-[rgba(var(--accent-blue),0.8)] text-white text-xs md:text-sm font-medium rounded-lg hover:bg-[rgba(var(--accent-blue),1)] transition-all duration-300 button-glow disabled:opacity-50"
          disabled={loading || generatedImages.length === 0}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default TimedImageGeneration; 