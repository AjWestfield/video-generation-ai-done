import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import AudioVolumeControls from "./AudioVolumeControls";
import { SoundEffect } from "@/services/soundEffectService";

interface VideoGenerationProps {
  images: string[];
  audioBase64: string;
  timedImages?: { timestamp: number; imageBase64: string }[];
  backgroundMusic?: string;
  soundEffects?: SoundEffect[];
  onVideoGenerated: (videoData: any) => void;
  onBack: () => void;
}

const VideoGeneration: React.FC<VideoGenerationProps> = ({
  images,
  audioBase64,
  timedImages,
  backgroundMusic,
  soundEffects,
  onVideoGenerated,
  onBack,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  // Audio volume states
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [soundEffectVolume, setSoundEffectVolume] = useState(0.7);
  const [musicVolume, setMusicVolume] = useState(0.2);
  
  // Start generating the video as soon as the component mounts
  useEffect(() => {
    // Don't auto-generate the video with our new controls
    // Let the user adjust audio first
  }, []);

  const generateVideo = async () => {
    setLoading(true);
    setError(null);
    
    // Simulate progress while the video is being generated
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 5;
      });
    }, 1000);

    try {
      const response = await fetch("/api/video/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images,
          timedImages,
          audioBase64,
          backgroundMusic,
          soundEffects,
          duration: 15, // Default duration in seconds
          // Include volume settings
          voiceVolume,
          soundEffectVolume,
          musicVolume
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate video");
      }

      const videoData = await response.json();
      
      // Wait for progress animation to complete
      setTimeout(() => {
        onVideoGenerated(videoData);
      }, 1000);
      
    } catch (err) {
      clearInterval(progressInterval);
      console.error("Error generating video:", err);
      setError((err as Error).message);
      toast.error("Failed to generate video. Please try again.");
      setLoading(false);
    }
  };

  const handleTryAgain = () => {
    generateVideo();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Video Generation</h2>
        <p className="text-gray-400 mt-2">
          Combining your {timedImages ? "timed " : ""}images, voiceover
          {backgroundMusic ? ", background music" : ""}
          {soundEffects && soundEffects.length > 0 ? ", and sound effects" : ""} to create a seamless video...
        </p>
        {timedImages && (
          <p className="text-xs text-gray-500 mt-1">
            Using {timedImages.length} images with precise timestamps for better synchronization
          </p>
        )}
        {backgroundMusic && (
          <p className="text-xs text-gray-500 mt-1">
            Adding AI-generated background music to enhance your video
          </p>
        )}
        {soundEffects && soundEffects.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Including {soundEffects.length} AI-generated sound effects for immersive experience
          </p>
        )}
      </div>

      {!loading && (
        <>
          <AudioVolumeControls 
            voiceVolume={voiceVolume}
            soundEffectVolume={soundEffectVolume}
            musicVolume={musicVolume}
            onVoiceVolumeChange={setVoiceVolume}
            onSoundEffectVolumeChange={setSoundEffectVolume}
            onMusicVolumeChange={setMusicVolume}
          />
          
          <div className="flex justify-center gap-4">
            <button
              onClick={onBack}
              className="py-2 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
            <button
              onClick={generateVideo}
              className="py-2 px-6 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Generate Video
            </button>
          </div>
        </>
      )}

      {loading && (
        <div className="space-y-6">
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="flex justify-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative w-64 h-36 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-pulse flex space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div 
                        key={i} 
                        className="w-3 h-3 bg-blue-500 rounded-full"
                        style={{ 
                          animationDelay: `${i * 200}ms`,
                          animation: 'bounce 1s infinite'
                        }}
                      ></div>
                    ))}
                  </div>
                </div>
                
                <div className="absolute bottom-0 left-0 w-full h-8 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-xs text-white">Processing video...</span>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-400">
                  {progress < 20 ? (
                    "Setting up processing environment..."
                  ) : progress < 40 ? (
                    "Converting images to video frames..."
                  ) : progress < 60 ? (
                    soundEffects && soundEffects.length > 0 ? "Adding sound effects..." : "Preparing audio..."
                  ) : progress < 80 ? (
                    backgroundMusic ? "Mixing audio tracks..." : "Adding audio track to video..."
                  ) : (
                    "Finalizing and optimizing video..."
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  This may take a minute or two
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="space-y-4">
          <div className="text-center text-red-500 p-3 bg-red-900/20 border border-red-900 rounded-lg">
            <p className="font-medium">Error generating video:</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={onBack}
              className="flex-1 py-2 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleTryAgain}
              className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoGeneration; 