import React, { useState, useEffect } from "react";
import { TimedImage } from "@/types";
import { SoundEffect, generateSoundEffectPrompts, generateAllSoundEffects } from "@/services/soundEffectService";
import toast from "react-hot-toast";

interface SoundEffectGenerationProps {
  script: string;
  timedImages: TimedImage[];
  onSoundEffectsGenerated: (soundEffects: SoundEffect[]) => void;
  onBack: () => void;
  autoGenerate?: boolean;
}

const SoundEffectGeneration: React.FC<SoundEffectGenerationProps> = ({
  script,
  timedImages,
  onSoundEffectsGenerated,
  onBack,
  autoGenerate = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundEffectPrompts, setSoundEffectPrompts] = useState<SoundEffect[]>([]);
  const [generatedSoundEffects, setGeneratedSoundEffects] = useState<SoundEffect[]>([]);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [generatingSounds, setGeneratingSounds] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(-1);
  const [processingComplete, setProcessingComplete] = useState(false);

  // If autoGenerate is true, start generating on mount
  useEffect(() => {
    if (autoGenerate) {
      handleGenerateSoundEffects();
    }
  }, []);

  // Only proceed to the next step when processing is complete
  useEffect(() => {
    if (processingComplete && generatedSoundEffects.length > 0) {
      // Wait a moment to ensure all sound effects are fully processed
      const timer = setTimeout(() => {
        onSoundEffectsGenerated(generatedSoundEffects);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (processingComplete && soundEffectPrompts.length === 0) {
      // If no sound effects were needed, also proceed
      onSoundEffectsGenerated([]);
    }
  }, [processingComplete, generatedSoundEffects, soundEffectPrompts]);

  const handleGenerateSoundEffects = async () => {
    setLoading(true);
    setError(null);
    setProcessingComplete(false);
    setGeneratingPrompts(true);

    try {
      // First, generate the prompts
      const prompts = await generateSoundEffectPrompts(script, timedImages);
      setSoundEffectPrompts(prompts);
      setGeneratingPrompts(false);

      if (prompts.length === 0) {
        toast.success("No sound effects needed for this video");
        setProcessingComplete(true);
        setLoading(false);
        return;
      }

      // Then generate the actual sound effects
      setGeneratingSounds(true);
      
      // Process sound effects sequentially and track progress
      const results: SoundEffect[] = [];
      for (let i = 0; i < prompts.length; i++) {
        setCurrentPromptIndex(i);
        try {
          const url = await generateSoundEffect(prompts[i].prompt);
          
          const effect: SoundEffect = {
            ...prompts[i],
            url
          };
          results.push(effect);
          setGeneratedSoundEffects([...results]);
        } catch (error) {
          console.error(`Error generating sound effect for prompt "${prompts[i].prompt}":`, error);
          // Continue with other sound effects even if one fails
        }
      }
      
      setGeneratedSoundEffects(results);
      setGeneratingSounds(false);
      setProcessingComplete(true);
      
      if (results.length === 0) {
        toast.error("Failed to generate any sound effects");
      } else if (results.length < prompts.length) {
        toast.warning(`Generated ${results.length} of ${prompts.length} sound effects`);
      } else {
        toast.success(`Successfully generated ${results.length} carefully placed sound effects`);
      }
    } catch (err) {
      console.error("Error generating sound effects:", err);
      setError((err as Error).message);
      toast.error("Failed to generate sound effects. Please try again.");
      setProcessingComplete(true);
    } finally {
      setLoading(false);
    }
  };

  const generateSoundEffect = async (prompt: string): Promise<string> => {
    // Call the API to generate a single sound effect
    const response = await fetch('/api/replicate/generate-sound-effect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate sound effect');
    }

    const data = await response.json();
    return data.soundEffectUrl;
  };

  const handleSkip = () => {
    setProcessingComplete(true);
    onSoundEffectsGenerated([]);
  };

  const handleProceed = () => {
    if (generatedSoundEffects.length > 0) {
      onSoundEffectsGenerated(generatedSoundEffects);
    } else {
      onSoundEffectsGenerated([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Sound Effect Generation</h2>
        <p className="text-gray-400 mt-2">
          Adding selective sound effects at key moments to enhance your video experience
        </p>
        <p className="text-xs text-gray-500 mt-1">
          We'll analyze your content and add 3-5 carefully placed sound effects at the most impactful moments
        </p>
      </div>

      {!loading && !autoGenerate && (
        <div className="flex justify-center gap-4">
          <button
            onClick={onBack}
            className="py-2 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSkip}
            className="py-2 px-4 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-500 transition-colors"
          >
            Skip Sound Effects
          </button>
          <button
            onClick={handleGenerateSoundEffects}
            className="py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Generate Sound Effects
          </button>
        </div>
      )}

      {(loading || autoGenerate) && (
        <div className="space-y-8">
          {/* Step 1: Generate Prompts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium">1. Identifying key moments for sound effects</h3>
              {generatingPrompts ? (
                <div className="flex items-center">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
                  <span className="text-blue-500 text-sm">Analyzing content...</span>
                </div>
              ) : soundEffectPrompts.length > 0 ? (
                <span className="text-green-500 text-sm">✓ Found {soundEffectPrompts.length} key moments</span>
              ) : (!generatingPrompts && !error) ? (
                <span className="text-yellow-500 text-sm">No sound effects needed</span>
              ) : null}
            </div>
            
            {!generatingPrompts && soundEffectPrompts.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                <ul className="space-y-2">
                  {soundEffectPrompts.map((effect, index) => (
                    <li key={index} className="text-sm">
                      <span className="text-gray-400">Timestamp {effect.timestamp}s:</span> <span className="text-white">{effect.prompt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Step 2: Generate Sound Effects */}
          {!generatingPrompts && soundEffectPrompts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">2. Creating tailored sound effects</h3>
                {generatingSounds ? (
                  <div className="flex items-center">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
                    <span className="text-blue-500 text-sm">
                      Processing {currentPromptIndex + 1}/{soundEffectPrompts.length}...
                    </span>
                  </div>
                ) : generatedSoundEffects.length > 0 ? (
                  <span className="text-green-500 text-sm">✓ Generated {generatedSoundEffects.length} sound effects</span>
                ) : null}
              </div>
              
              {generatedSoundEffects.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <ul className="space-y-2">
                    {generatedSoundEffects.map((effect, index) => (
                      <li key={index} className="text-sm flex items-center justify-between">
                        <div>
                          <span className="text-gray-400">Timestamp {effect.timestamp}s:</span> <span className="text-white">{effect.prompt}</span>
                        </div>
                        {effect.url && (
                          <button 
                            className="text-blue-400 hover:text-blue-300 text-xs"
                            onClick={() => {
                              // Play the sound effect if available
                              if (effect.url) {
                                const audio = new Audio(effect.url);
                                audio.play();
                              }
                            }}
                          >
                            Play ▶
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-center text-red-500 p-3 bg-red-900/20 border border-red-900 rounded-lg">
              <p className="font-medium">Error generating sound effects:</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Manual proceed button for when auto-proceed fails */}
          {!autoGenerate && processingComplete && !loading && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleProceed}
                className="py-2 px-6 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continue to Video Generation
              </button>
            </div>
          )}

          {/* Auto-generate status message */}
          {autoGenerate && processingComplete && !error && (
            <div className="text-center text-green-500 mt-4">
              <p>Processing complete! Proceeding to video generation...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SoundEffectGeneration; 