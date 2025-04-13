import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Wand2 } from 'lucide-react';

interface ImageDataType {
  base64: string; // Expecting base64 data from page.tsx now
  prompt: string;
}

interface AnimationRequestType {
  predictionId: string;
  index: number;
  originalPrompt: string;
  motionPrompt: string;
}

interface AnimationResultType {
  url: string;
  prompt: string;
  originalPrompt: string;
  duration: number;
  index: number;
}

interface AnimationControlProps {
  images: ImageDataType[]; // Expect base64 data with prompts
  onAnimate: (videos: { url: string; prompt: string; duration: number }[]) => void; // Callback with generated videos
  disabled?: boolean; // Optional disabled state
}

const AnimationControl: React.FC<AnimationControlProps> = ({ images, onAnimate, disabled = false }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  
  // Generate motion prompts using OpenRouter's Gemini model
  const generateMotionPrompts = async (originalPrompts: string[]): Promise<string[]> => {
    try {
      // Process all prompts at once
      console.log(`Generating motion prompts for all ${originalPrompts.length} prompts at once`);

      const response = await fetch('/api/openrouter/generate-motion-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompts: originalPrompts, // Send all prompts
          model: 'google/gemini-2.0-flash-001',
          context: "These are static image descriptions that need to be animated into 5-second video clips using the Kling animation model. Generate motion prompts that describe camera movements and actions appropriate for each scene."
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate motion prompts');
      }

      const data = await response.json();
      return data.motionPrompts;

    } catch (error) {
      console.error('Failed to generate motion prompts:', error);
      // Fallback to simple motion prompts if the API fails
      return originalPrompts.map(prompt =>
        `Animate this scene with gentle camera motion: ${prompt}`
      );
    }
  };
  
  // Process animations in batches to avoid rate limits
  const processBatchAnimations = async (
    imageDataItems: ImageDataType[], 
    motionPrompts: string[],
    batchSize = 5,
    maxRetries = 3
  ) => {
    const results: Array<{ url: string; prompt: string; duration: number } | null> = Array(imageDataItems.length).fill(null);
    const totalImages = imageDataItems.length;
    let completedCount = 0;
    
    const toastId = toast.loading(`Processing ${totalImages} animations...`);
    
    try {
      // Process all animations at once instead of in batches
      console.log(`Processing all ${totalImages} images at once`);
      
      // Start animations for all images
      const allRequests = await Promise.all(
        imageDataItems.map(async (image, index) => {
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              const motionPrompt = motionPrompts[index] || `Animate this scene with gentle camera motion: ${image.prompt}`;
              
              const response = await fetch('/api/animate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageData: image.base64,
                  motionPrompt: motionPrompt
                })
              });
    
              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Animation failed for image ${index + 1}`);
              }
    
              const data = await response.json();
              
              if (!data.predictionIds || !data.predictionIds[0]) {
                throw new Error(`No prediction ID returned for image ${index + 1}`);
              }
              
              return {
                predictionId: data.predictionIds[0],
                index,
                originalPrompt: image.prompt,
                motionPrompt
              };
            } catch (error) {
              console.error(`Error starting animation for image ${index + 1} (attempt ${attempt + 1}/${maxRetries}):`, error);
              if (attempt === maxRetries - 1) {
                throw error;
              }
              
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          
          throw new Error(`Failed to start animation for image ${index + 1} after ${maxRetries} attempts`);
        })
      ).catch(error => {
        console.error('Error in animations:', error);
        return Array(totalImages).fill(null);
      });
      
      // Filter out failed requests
      const validRequests = allRequests.filter(Boolean) as AnimationRequestType[];
      
      if (validRequests.length === 0) {
        console.warn(`No valid animation requests`);
        return [];
      }
      
      // Monitor all animations
      toast.loading(`Waiting for animations to complete...`, { id: toastId });
      
      // Poll for results
      const statusPollingInterval = 3000; // 3 seconds
      const maxStatusRetries = 60; // Up to 3 minutes per animation
      
      const allResults = await Promise.all(
        validRequests.map(async request => {
          for (let statusAttempt = 0; statusAttempt < maxStatusRetries; statusAttempt++) {
            try {
              // Wait between polls
              if (statusAttempt > 0) {
                await new Promise(resolve => setTimeout(resolve, statusPollingInterval));
              }
              
              const statusResponse = await fetch('/api/animate/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ predictionId: request.predictionId })
              });
              
              if (!statusResponse.ok) {
                console.warn(`Status check failed for image ${request.index + 1} (attempt ${statusAttempt + 1})`);
                continue;
              }
              
              const statusData = await statusResponse.json();
              
              if (statusData.status === 'complete' && statusData.output) {
                completedCount++;
                setAnimationProgress(Math.round((completedCount / totalImages) * 100));
                
                console.log(`Animation completed for image ${request.index + 1}: ${statusData.output}`);
                
                return {
                  url: statusData.output,
                  prompt: request.motionPrompt,
                  originalPrompt: request.originalPrompt,
                  duration: 5,
                  index: request.index
                };
              } 
              else if (statusData.status === 'failed') {
                console.error(`Animation ${request.index + 1} failed:`, statusData.error || 'Unknown error');
                break;
              }
              
              // Still processing, continue polling
            } catch (error) {
              console.error(`Error checking status for animation ${request.index + 1}:`, error);
            }
          }
          
          console.warn(`Timed out waiting for animation ${request.index + 1}`);
          return null;
        })
      );
      
      // Save all results
      allResults.forEach(result => {
        if (result) {
          results[result.index] = {
            url: result.url,
            prompt: result.prompt,
            duration: result.duration
          };
        }
      });
      
      // Update final progress
      const finalCompleted = results.filter(Boolean).length;
      setAnimationProgress(Math.round((finalCompleted / totalImages) * 100));
      toast.loading(`Completed ${finalCompleted}/${totalImages} animations (${Math.round((finalCompleted / totalImages) * 100)}%)`, { id: toastId });
      
    } catch (error) {
      console.error("Error processing animations:", error);
      toast.error(`Animation processing error: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: toastId });
    }
    
    // Return all results
    return results.filter(Boolean);
  };
  
  const handleAnimate = async () => {
    if (!images || images.length === 0) {
      toast.error("No images available to animate.");
      return;
    }

    setIsAnimating(true);
    setAnimationProgress(0);
    let loadingToastId = toast.loading(`Starting animation for ${images.length} images...`);

    try {
      // Extract original prompts from images
      const originalPrompts = images.map(img => img.prompt);
      
      // Generate motion prompts
      toast.loading('Generating motion prompts...', { id: loadingToastId });
      const motionPrompts = await generateMotionPrompts(originalPrompts);
      
      if (motionPrompts.length !== images.length) {
        console.warn(`Motion prompts count (${motionPrompts.length}) doesn't match images count (${images.length}). Adjusting...`);
      }
      
      // Start processing all animations at once
      toast.loading(`Processing all ${images.length} animations...`, { id: loadingToastId });
      
      // Process all animations at once
      const animatedVideos = await processBatchAnimations(images, motionPrompts);
      
      // Success message
      const successCount = animatedVideos.length;
      if (successCount > 0) {
        toast.success(`Successfully generated ${successCount} of ${images.length} video clips!`, { id: loadingToastId });
        onAnimate(animatedVideos);
      } else {
        throw new Error("Failed to generate any video clips");
      }
    } catch (error: any) {
      console.error("Animation failed:", error);
      toast.error(`Animation failed: ${error.message}`, { id: loadingToastId });
    } finally {
      setIsAnimating(false);
    }
  };

  return (
    <div className="my-4 text-center">
      <button 
        disabled={isAnimating || disabled || images.length === 0}
        onClick={handleAnimate}
        className={`
          px-6 py-2 rounded-lg font-medium transition-all duration-300 ease-in-out relative overflow-hidden
          text-white text-sm md:text-base inline-flex items-center justify-center
          ${isAnimating || disabled || images.length === 0
            ? 'bg-gray-600 cursor-not-allowed text-gray-400'
            : 'bg-gradient-to-r from-[rgba(var(--accent-purple),0.8)] to-[rgba(var(--accent-pink),0.8)] hover:from-[rgba(var(--accent-purple),1)] hover:to-[rgba(var(--accent-pink),1)] button-glow-alt'
          }
        `}
      >
        {isAnimating && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-purple-900 opacity-50"
               style={{ width: `${animationProgress}%` }}></div>
        )}
        <span className="relative z-10 flex items-center justify-center space-x-2">
          {isAnimating ? (
            <> 
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg> 
            <span>Generating Videos... {animationProgress}%</span>
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Animate Storyboard (5s Clips)
            </>
          )}
        </span>
      </button>
    </div>
  );
};

export default AnimationControl;
