"use client";

import { useState, useCallback, useEffect } from "react";
import VideoIdeaForm from "../components/VideoIdeaForm";
import ScriptGeneration from "../components/ScriptGeneration";
// Remove unused imports
// Keep original imports, remove VoiceInput and TranscriptImagePromptReview for now
import VoiceoverGeneration from "../components/VoiceoverGeneration";
import ImageGeneration from "../components/ImageGeneration";
import MusicGeneration from "../components/MusicGeneration";
import VideoGeneration from "../components/VideoGeneration";
import VideoPreview from "../components/VideoPreview";
import ProgressStepper from "../components/ProgressStepper";
import { Toaster } from "react-hot-toast";
import { storeImageData, retrieveImageData } from "../lib/storage"; // Add retrieveImageData import

export default function Home() {
  // Define the workflow states
  const [step, setStep] = useState(1);
  const [videoIdea, setVideoIdea] = useState<string>("");
  const [videoDuration, setVideoDuration] = useState<number>(1);
  const [narrativeMode, setNarrativeMode] = useState<boolean>(false);
  const [storyStructure, setStoryStructure] = useState<string>("standard");
  const [scriptData, setScriptData] = useState<{ script: string; title: string }>({ script: "", title: "" });
  const [voiceoverData, setVoiceoverData] = useState<{ audioBase64: string; voiceId: string; script: string } | null>(null);
  // Update state type to include transcriptSegment
  const [finalImagePrompts, setFinalImagePrompts] = useState<{ timestamp: number; imagePrompt: string; transcriptSegment: string }[] | null>(null);
  const [imageData, setImageData] = useState<string[]>([]); // ImageGeneration still expects string[] (base64)
  const [musicData, setMusicData] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<any>(null);
  // Add flag to track if images have been generated
  const [imagesGenerated, setImagesGenerated] = useState<boolean>(false);

  // Steps reflecting the new flow integrated into VoiceoverGeneration
  const steps = [
    "Video Idea",
    "Script Generation",
    "Voiceover & Prompts", // Combined Step 3 (Voiceover Gen + Review)
    "Image Generation",    // Step 4
    "Music Generation",    // Step 5
    "Video Creation",      // Step 6
  ];

  // Function to handle navigation to prevent image regeneration
  const handleNavigate = useCallback((targetStep: number) => {
    setStep(targetStep);
  }, []);

  // Load cached images when navigating back to the image generation step
  useEffect(() => {
    const loadCachedImages = async () => {
      if (step === 4 && finalImagePrompts && finalImagePrompts.length > 0 && !imageData.length && imagesGenerated) {
        console.log("Loading cached images from IndexedDB...");
        try {
          const cachedImages = await retrieveImageData(true); // true for production mode
          if (cachedImages && cachedImages.length > 0) {
            // Sort images by timestamp to match prompts order
            cachedImages.sort((a, b) => a.timestamp - b.timestamp);
            // Extract base64 strings in order
            const base64Images = cachedImages.map(img => img.imageBase64);
            setImageData(base64Images);
            console.log(`Successfully loaded ${base64Images.length} cached images`);
          } else {
            console.log("No cached images found");
          }
        } catch (error) {
          console.error("Failed to load cached images:", error);
        }
      }
    };
    
    loadCachedImages();
  }, [step, finalImagePrompts, imageData.length, imagesGenerated]);

  const handleVideoIdeaSubmit = useCallback((idea: string, duration: number, isNarrativeMode: boolean, structure: string) => {
    setVideoIdea(idea);
    setVideoDuration(duration);
    setNarrativeMode(isNarrativeMode);
    setStoryStructure(structure);
    setStep(2); // Go to Script Generation
  }, []);

  const handleScriptGenerated = useCallback((data: { script: string; title: string }) => {
    setScriptData(data);
    setStep(3); // Go to Voiceover Generation & Prompt Review
  }, []);

  // Modified callback for VoiceoverGeneration component
  // Update type to expect transcriptSegment
  const handleVoiceoverAndPromptsGenerated = useCallback((data: {
    voiceover: { audioBase64: string; voiceId: string; script: string };
    finalPrompts: { timestamp: number; imagePrompt: string; transcriptSegment: string }[];
  }) => {
    setVoiceoverData(data.voiceover);
    setFinalImagePrompts(data.finalPrompts); // Store the complete data including transcriptSegment
    setStep(4); // Go to Image Generation
  }, []);

  // Callback for ImageGeneration component now stores images in IndexedDB
  const handleImagesGenerated = useCallback(async (base64ImageArray: string[]) => {
    // Store the base64 strings in state as before
    setImageData(base64ImageArray);
    // Set flag that images have been generated
    setImagesGenerated(true);
    
    // If the user has over 1000 credits, then we store the images in their account
    // Otherwise we just use IndexedDB for temporary storage
    const hasPaidAccount = false; // TODO: Replace with actual check
    
    // Skip IndexedDB if no prompts data is available
    if (finalImagePrompts && finalImagePrompts.length > 0) {
      try {
        // Update the store location where the base64 image strings are saved
        const imageData = base64ImageArray.map((base64, index) => {
          // Find corresponding prompt
          const timestamp = finalImagePrompts[index].timestamp;
          
          // For now, we're just separating the prompts by timestamp
          return {
            timestamp: timestamp,
            imageBase64: base64,
          };
        });

        // Save to indexedDB
        await storeImageData(imageData, true); // true for production mode
        console.log("Successfully stored images in IndexedDB");
      } catch (error) {
        console.error("Failed to store images in IndexedDB:", error);
      }
    }
    
    // Continue to next step
    setStep(5); // Go to Music Generation
  }, [finalImagePrompts]);

  const handleMusicGenerated = useCallback((data: { musicUrl: string; musicPrompt: string }) => {
    setMusicData(data.musicUrl);
    setStep(6); // Go to Video Creation
  }, []);

  // Handle video generation completion
  const handleVideoGenerated = (data: any) => {
    setVideoData(data);
    setStep(7); // Go to Video Preview
  };

  // Reset the workflow - include finalImagePrompts
  const handleReset = () => {
    setVideoIdea("");
    setVideoDuration(1);
    setNarrativeMode(false);
    setStoryStructure("standard");
    setScriptData({ script: "", title: "" });
    setVoiceoverData(null);
    setFinalImagePrompts(null); // Reset new state
    setImageData([]);
    setMusicData(null);
    setVideoData(null);
    setImagesGenerated(false); // Reset image generation flag
    setStep(1);
  };

  // Add a useEffect to log when images are being used from cache
  useEffect(() => {
    if (step === 4 && finalImagePrompts) {
      console.log("Rendering Image Generation", {
        imagesGenerated,
        imageDataLength: imageData.length,
        skipGeneration: imagesGenerated && imageData.length > 0
      });
    }
  }, [step, finalImagePrompts, imagesGenerated, imageData.length]);

  return (
    <main className="flex min-h-screen flex-col items-center p-2 md:p-6 lg:p-8">
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(20, 25, 45, 0.85)',
            color: '#fff',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(100, 130, 255, 0.2)',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3), 0 0 10px rgba(80, 130, 255, 0.3)'
          },
        }}
      />
      
      <div className="container max-w-5xl mx-auto space-y-4 md:space-y-6">
        <header className="text-center space-y-2">
          <div className="relative inline-block">
            <h1 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#50d2f0] via-[#4e7aff] to-[#a866ff] text-glow">
              AI Video Creator
            </h1>
            <div className="absolute -inset-4 bg-gradient-to-r from-[rgba(var(--accent-cyan),0.2)] via-[rgba(var(--accent-blue),0.1)] to-[rgba(var(--accent-purple),0.2)] blur-xl opacity-30 rounded-full -z-10"></div>
          </div>
          <p className="text-gray-300 max-w-2xl mx-auto text-sm md:text-base">
            Transform your ideas into stunning videos with the power of AI. Just enter your concept and watch it come to life.
          </p>
        </header>

        <ProgressStepper 
          steps={steps} 
          currentStep={step} 
          onStepClick={handleNavigate} 
        />

        <div className="bg-glass rounded-xl p-3 md:p-5 shadow-xl border border-[rgba(var(--accent-blue),0.15)] box-glow relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-cyan),0.5)] to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--accent-blue),0.3)] to-transparent"></div>
          
          {step === 1 && (
            <VideoIdeaForm onSubmit={handleVideoIdeaSubmit} />
          )}
          
          {step === 2 && (
            <ScriptGeneration 
              videoIdea={videoIdea}
              videoDuration={videoDuration}
              narrativeMode={narrativeMode}
              storyStructure={storyStructure}
              onScriptGenerated={handleScriptGenerated}
              onBack={() => setStep(1)}
            />
          )}

          {/* Step 3: Voiceover Generation & Prompt Review */}
          {step === 3 && scriptData && (
            <VoiceoverGeneration
              script={scriptData.script}
              // Pass the new combined callback
              onVoiceoverAndPromptsGenerated={handleVoiceoverAndPromptsGenerated}
              onBack={() => setStep(2)}
              autoGenerate={false} // Keep manual generation trigger
            />
          )}

          {/* Step 4: Image Generation */}
          {step === 4 && finalImagePrompts && (
             <ImageGeneration
               // Pass the finalized prompts directly
               promptsToGenerate={finalImagePrompts} // Changed prop name
               onImagesGenerated={handleImagesGenerated}
               onBack={() => setStep(3)} // Go back to Voiceover/Prompt step
               skipInitialGeneration={imagesGenerated && imageData.length > 0} // Skip generation if images already exist
               existingImages={imagesGenerated ? imageData : []} // Pass existing images if available
             />
           )}

          {/* Step 5: Music Generation */}
          {step === 5 && scriptData && imageData.length > 0 && (
            <MusicGeneration
              script={scriptData.script}
              // Pass original voiceover base64 if MusicGeneration needs it
              audioBase64={voiceoverData?.audioBase64}
              onMusicGenerated={handleMusicGenerated}
              onBack={() => setStep(4)} // Go back to Image Generation
            />
          )}

          {/* Step 6: Video Creation */}
          {step === 6 && imageData.length > 0 && musicData && voiceoverData && (
            <VideoGeneration
              script={scriptData.script}
              title={scriptData.title}
              // Pass original voiceover base64
              voiceoverAudio={voiceoverData.audioBase64}
              // Map image data as before
              images={imageData.map((imgBase64, index) => ({
                // Use timestamp from finalImagePrompts if available and lengths match, else use index
                timestamp: finalImagePrompts && finalImagePrompts[index] ? finalImagePrompts[index].timestamp : index,
                imageBase64: imgBase64
              }))}
              musicAudio={musicData} // Pass music URL
              onVideoGenerated={handleVideoGenerated}
              onBack={() => setStep(5)} // Go back to Music Generation
            />
          )}

          {/* Step 7: Video Preview */}
          {step === 7 && videoData && (
            <VideoPreview
              videoUrl={videoData.videoUrl}
              onReset={handleReset}
            />
          )}
        </div>
      </div>
      
      {/* Decorative elements - made smaller and less intrusive */}
      <div className="fixed top-20 right-10 w-24 h-24 bg-[rgba(var(--accent-purple),0.15)] rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
      <div className="fixed bottom-10 left-10 w-32 h-32 bg-[rgba(var(--accent-blue),0.1)] rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
      <div className="fixed top-1/3 left-20 w-16 h-16 bg-[rgba(var(--accent-cyan),0.15)] rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
    </main>
  );
}
