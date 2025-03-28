import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";

interface MusicGenerationProps {
  script: string;
  audioBase64?: string; // Add voiceover audio to props
  onMusicGenerated: (musicData: { musicUrl: string; musicPrompt: string }) => void;
  onBack: () => void;
}

// Configure toast position globally
const toastOptions = {
  position: "bottom-right" as const,
  duration: 4000
};

const MusicGeneration: React.FC<MusicGenerationProps> = ({
  script,
  audioBase64,
  onMusicGenerated,
  onBack,
}) => {
  const [promptLoading, setPromptLoading] = useState(false);
  const [musicLoading, setMusicLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCustomPrompt, setIsCustomPrompt] = useState(false);
  const [voiceoverDuration, setVoiceoverDuration] = useState<number>(60); // Default to 60 seconds (longer)
  const [durationDetected, setDurationDetected] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceoverAudioRef = useRef<HTMLAudioElement | null>(null);
  const toastIdRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate voiceover duration when component mounts
  useEffect(() => {
    if (audioBase64) {
      calculateVoiceoverDuration(audioBase64);
    }
  }, [audioBase64]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      // Clear any pending toasts when the component unmounts
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
      
      // Clear any running intervals
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Generate a prompt based on the script when component mounts
  useEffect(() => {
    generateMusicPrompt();
  }, []);

  // Helper function to show a single error toast
  const showErrorToast = (message: string) => {
    // Dismiss any existing toast
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
    }
    // Show new error toast and store its ID
    toastIdRef.current = toast.error(message, toastOptions);
  };

  // Calculate the duration of the voiceover audio
  const calculateVoiceoverDuration = (audioBase64String: string) => {
    if (!audioBase64String) {
      console.error("No audio data provided for duration calculation");
      return;
    }
    
    // Create an audio element to get the duration
    const audio = document.createElement('audio');
    
    // Set up event listeners
    audio.addEventListener('loadedmetadata', () => {
      const duration = Math.ceil(audio.duration);
      console.log("Calculated voiceover duration:", duration, "seconds");
      setVoiceoverDuration(duration);
      setDurationDetected(true);
    });
    
    audio.addEventListener('error', (e) => {
      console.error("Error loading voiceover audio:", e);
      // If there's an error, we'll rely on the default duration
    });
    
    // Make sure we have a valid audio Base64 string
    try {
      // Check if the string already has a data URL prefix
      const audioSrc = audioBase64String.startsWith('data:audio') 
        ? audioBase64String 
        : `data:audio/mp3;base64,${audioBase64String.replace(/^data:audio\/\w+;base64,/, '')}`;
      
      // Set the source and load the audio
      audio.src = audioSrc;
      voiceoverAudioRef.current = audio;
    } catch (err) {
      console.error("Error setting audio source:", err);
    }
  };

  const generateMusicPrompt = async () => {
    setPromptLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/openrouter/generate-music-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          script: script
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate music prompt");
      }

      const data = await response.json();
      setGeneratedPrompt(data.prompt);
      // Also set as custom prompt so user can edit if needed
      setCustomPrompt(data.prompt);

    } catch (err) {
      console.error("Error generating music prompt:", err);
      setError("Failed to generate music prompt. Please try again.");
      showErrorToast("Failed to generate music prompt. Please try again.");
    } finally {
      setPromptLoading(false);
    }
  };

  const generateMusic = async (prompt: string) => {
    setMusicLoading(true);
    setError(null);
    setGenerationProgress(0);
    
    // Display a loading toast that will be replaced by error or dismissed on success
    toastIdRef.current = toast.loading("Starting music generation...", toastOptions);
    
    // Start a progress simulation for better UX during the potentially long wait
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    // Adjust progress speed based on audio duration
    const progressSpeed = voiceoverDuration > 60 ? 0.8 : 2;
    
    let progress = 0;
    progressIntervalRef.current = setInterval(() => {
      progress += Math.random() * progressSpeed; // Random increase for more natural feeling
      
      // Cap at 95% - will go to 100% when the actual request completes
      if (progress > 95) {
        progress = 95;
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      }
      
      setGenerationProgress(progress);
      
      // Update the loading toast message periodically
      if (toastIdRef.current) {
        const phase = progress < 30 ? "Composing music..." 
                    : progress < 60 ? "Arranging instruments..." 
                    : progress < 85 ? "Mixing audio..." 
                    : "Finalizing...";
        
        toast.loading(phase, { id: toastIdRef.current, ...toastOptions });
      }
    }, 1000);

    try {
      console.log(`Generating music for ${voiceoverDuration} seconds of voiceover...`);
      
      const response = await fetch("/api/replicate/generate-music", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt,
          model_version: "stereo-large",
          voiceoverDuration: voiceoverDuration
        }),
      });

      // Clear the progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // Set progress to 100% to show completion
      setGenerationProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate music");
      }

      const data = await response.json();
      
      if (!data.musicUrl) {
        throw new Error("No music URL returned from the API");
      }
      
      console.log("Received music URL:", data.musicUrl);
      console.log("Generated music duration:", data.duration, "seconds");
      console.log("Voiceover duration:", voiceoverDuration, "seconds");
      
      // Verify the URL is a string and looks like a valid URL
      if (typeof data.musicUrl !== 'string' || 
          (!data.musicUrl.startsWith('http://') && !data.musicUrl.startsWith('https://'))) {
        console.error("Invalid music URL received:", data.musicUrl);
        throw new Error("Received an invalid music URL from the server");
      }
      
      // Store the valid URL
      setMusicUrl(data.musicUrl);

      // Dismiss the loading toast on success
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }

      // Show success notification
      toast.success("Music generated successfully!", toastOptions);

      // Automatically play the generated music
      if (audioRef.current) {
        // Force loading of the new URL
        audioRef.current.src = data.musicUrl;
        audioRef.current.load();
        audioRef.current.play().catch(e => {
          console.error("Error playing audio:", e);
          // Don't show a toast for autoplay errors, as they're often due to browser policies
        });
      }

    } catch (err) {
      console.error("Error generating music:", err);
      setError((err as Error).message);
      
      // Clear the progress interval if it's still running
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // Update the loading toast to an error
      if (toastIdRef.current) {
        toast.error("Failed to generate music. Please try again.", {
          id: toastIdRef.current,
          ...toastOptions
        });
      }
    } finally {
      setMusicLoading(false);
    }
  };

  const handleGenerateClick = () => {
    const prompt = isCustomPrompt ? customPrompt : generatedPrompt;
    if (!prompt.trim()) {
      showErrorToast("Please provide a prompt for music generation");
      return;
    }
    generateMusic(prompt);
  };

  const handleUseMusic = () => {
    if (!musicUrl) {
      showErrorToast("Please generate music first");
      return;
    }
    
    onMusicGenerated({
      musicUrl,
      musicPrompt: isCustomPrompt ? customPrompt : generatedPrompt
    });
  };

  const handleRegeneratePrompt = () => {
    generateMusicPrompt();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Background Music</h2>
        <p className="text-gray-400 mt-2">
          Generate background music for your video based on the script content
        </p>
        {voiceoverDuration > 0 && (
          <p className="text-xs text-gray-500">
            Music will match your voiceover duration: {voiceoverDuration} seconds
            {!durationDetected && " (estimated)"}
          </p>
        )}
      </div>

      <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <h3 className="font-medium text-white">Music Prompt</h3>
        {promptLoading ? (
          <div className="h-24 bg-gray-700 animate-pulse rounded flex items-center justify-center">
            <p className="text-gray-400">Generating prompt...</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 items-center mb-2">
              <label className="inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isCustomPrompt}
                  onChange={() => setIsCustomPrompt(!isCustomPrompt)}
                />
                <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-300">Custom prompt</span>
              </label>
              {!isCustomPrompt && (
                <button
                  onClick={handleRegeneratePrompt}
                  disabled={promptLoading}
                  className="text-xs py-1 px-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                >
                  Regenerate
                </button>
              )}
            </div>

            {isCustomPrompt ? (
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full h-24 p-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm"
                placeholder="Enter a detailed prompt for the music..."
              />
            ) : (
              <div className="p-3 bg-gray-900 border border-gray-700 rounded-md text-white text-sm h-24 overflow-auto">
                {generatedPrompt || "No prompt generated yet"}
              </div>
            )}
          </>
        )}
      </div>

      {musicLoading && (
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-3">
          <h3 className="font-medium text-white">Generating Music</h3>
          <div className="h-3 w-full bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${generationProgress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-400 text-center">
            {generationProgress < 30 
              ? `Composing ${voiceoverDuration}-second music track based on your prompt...` 
              : generationProgress < 60 
              ? "Arranging instruments and harmonies..." 
              : generationProgress < 85 
              ? "Mixing and mastering the audio..." 
              : "Finalizing your music..."}
          </p>
          <p className="text-xs text-gray-500 text-center mt-1">
            {voiceoverDuration > 45 
              ? "This can take up to 2-4 minutes for longer audio" 
              : "This can take up to 1-2 minutes"}
          </p>
        </div>
      )}

      {musicUrl && (
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h3 className="font-medium text-white mb-3">Preview Music</h3>
          <audio 
            ref={audioRef} 
            controls 
            className="w-full" 
            src={musicUrl}
            key={musicUrl} // Add key to force re-render when URL changes
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {error && (
        <div className="text-center text-red-500 p-3 bg-red-900/20 border border-red-900 rounded-lg">
          <p className="font-medium">Error:</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-2 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
        >
          Back
        </button>
        
        {musicUrl ? (
          <button
            onClick={handleUseMusic}
            className="flex-1 py-2 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Use This Music
          </button>
        ) : (
          <button
            onClick={handleGenerateClick}
            disabled={promptLoading || musicLoading}
            className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-800 disabled:opacity-50"
          >
            {musicLoading ? "Generating..." : "Generate Music"}
          </button>
        )}
      </div>
    </div>
  );
};

export default MusicGeneration; 