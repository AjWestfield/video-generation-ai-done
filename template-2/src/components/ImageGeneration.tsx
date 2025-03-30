import React, { useState, useEffect, useCallback, useRef } from "react"; // Import useRef
import toast from "react-hot-toast";
import Image from "next/image";
import ImageFocusModal from "./ImageFocusModal"; // Import the modal component

// Define the structure for the prompts we receive (including transcript)
interface PromptData {
  timestamp: number;
  imagePrompt: string;
  transcriptSegment: string; // Ensure this is included
}

// Define structure for modal data
interface ModalImageData {
  src: string | null;
  prompt: string;
  transcriptSegment: string;
  timestamp: number;
  index: number;
  isNsfwPlaceholder: boolean;
}

interface ImageGenerationProps {
  promptsToGenerate: PromptData[]; // Changed prop name and type
  onImagesGenerated: (images: string[]) => void; // Keep this as is for now
  onBack: () => void;
}

const ImageGeneration: React.FC<ImageGenerationProps> = ({
  promptsToGenerate, // Use the new prop name
  onImagesGenerated,
  onBack,
}) => {
  const [loading, setLoading] = useState(false); // Loading state for individual image
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // Re-add for sequential generation
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Store prompts with timestamps and transcript for potential editing/display
  const [editablePrompts, setEditablePrompts] = useState<PromptData[]>(promptsToGenerate);
  // State for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImageData, setSelectedImageData] = useState<ModalImageData | null>(null);


  const totalImages = promptsToGenerate.length;
  // Progress calculation can be used again for sequential
  const progress = totalImages > 0 ? Math.round(((currentImageIndex + (loading ? 0 : (generatedImages[currentImageIndex] ? 1 : 0))) / totalImages) * 100) : 0;


  // --- Reinstated Sequential Generation Logic ---
  const generateNextImage = useCallback(async (indexToGenerate: number) => {
    if (indexToGenerate >= totalImages) {
      setLoading(false); // Finished all
      return;
    }

    setLoading(true); // Loading this specific image
    // Clear error for the current attempt
    if (indexToGenerate === currentImageIndex) setError(null);
    const currentPromptData = editablePrompts[indexToGenerate];
    if (!currentPromptData) {
       console.error(`No prompt data found for index ${indexToGenerate}`);
       setLoading(false);
       return; // Should not happen
    }
    const prompt = currentPromptData.imagePrompt;
    toast.loading(`Generating image ${indexToGenerate + 1}/${totalImages}...`, { id: `image-gen-${indexToGenerate}` });

    try {
      // Call the single image generation endpoint
      const response = await fetch("/api/replicate/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }), // Send only the prompt string
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Check the specific isNsfwError flag returned by the updated API
        if (errorData?.isNsfwError) {
           console.warn(`NSFW error received for prompt at index ${indexToGenerate}.`);
           toast.error(`NSFW content detected for image ${indexToGenerate + 1}. Please edit prompt or regenerate.`, { id: `image-gen-${indexToGenerate}` });
           // Store the placeholder
           setGeneratedImages((prev) => {
             const updated = [...prev];
             updated[indexToGenerate] = "NSFW_PLACEHOLDER";
             return updated;
           });
           // Move to the next image without setting the main error state
           setCurrentImageIndex(indexToGenerate + 1);
           generateNextImage(indexToGenerate + 1);
           return; // Stop processing this one, let the user handle the placeholder
        }
        // Otherwise, it's a different error
        throw new Error(errorData.error || `API Error: ${response.statusText}`);
      }

      const data = await response.json();

      // Expecting { imageBase64: string } from the single image API
      if (!data.imageBase64) {
        throw new Error("Invalid response format from image generation API (missing imageBase64)");
      }

      const base64data = data.imageBase64;

      // Update the specific index in the generatedImages array
      setGeneratedImages((prev) => {
        const updated = [...prev];
        updated[indexToGenerate] = base64data;
        return updated;
      });

      toast.success(`Image ${indexToGenerate + 1} generated!`, { id: `image-gen-${indexToGenerate}` });

      // Move to the next image
      setCurrentImageIndex(indexToGenerate + 1);
      generateNextImage(indexToGenerate + 1); // Trigger next generation

    } catch (err) {
      console.error(`Error generating image ${indexToGenerate + 1}:`, err);
      setError((err as Error).message);
      toast.error(`Failed to generate image ${indexToGenerate + 1}: ${(err as Error).message}`, { id: `image-gen-${indexToGenerate}` });
      setLoading(false); // Stop loading on error for this sequence
      // Do not proceed automatically on error
    }
  // Add dependencies for sequential logic
  }, [totalImages, editablePrompts, currentImageIndex]); // Dependencies needed

  // Trigger the first image generation ONLY on initial mount or when promptsToGenerate fundamentally changes.
  // Use a ref to track if initial generation has started/completed to prevent re-triggering on regenerations.
  const initialGenerationStarted = useRef(false);
  useEffect(() => {
    if (promptsToGenerate.length > 0 && !initialGenerationStarted.current && !loading) {
      console.log("Starting initial image generation sequence...");
      initialGenerationStarted.current = true; // Mark as started
      setGeneratedImages(Array(promptsToGenerate.length).fill("")); // Initialize array
      setCurrentImageIndex(0); // Ensure we start from 0
      generateNextImage(0); // Start generation from the first image
    }
    // Only depend on promptsToGenerate to trigger a full reset/restart if the input prompts change.
    // Do NOT depend on loading, currentImageIndex, or generatedImages here.
  }, [promptsToGenerate, generateNextImage, loading]); // Keep loading here to prevent starting while another process might be loading


  const handleEditPrompt = (index: number, newPrompt: string) => {
    // Prevent editing if generation is in progress for this or subsequent images
    if (loading && currentImageIndex <= index) {
       toast.error("Cannot edit prompts while generation is in progress.");
       return;
    }
    const updatedPrompts = [...editablePrompts];
    updatedPrompts[index] = { ...updatedPrompts[index], imagePrompt: newPrompt };
    setEditablePrompts(updatedPrompts);
    // Clear the generated image for this index if it exists, forcing regeneration if needed
    if (generatedImages[index]) {
       setGeneratedImages(prev => {
          const updated = [...prev];
          updated[index] = ""; // Clear the image string, could use null/undefined if array type changes
          return updated;
       });
       // Optionally reset currentImageIndex if you want regeneration to restart from here
       // setCurrentImageIndex(index);
    }
  };

  // Regenerate a single image
  const handleRegenerateImage = (index: number) => {
    if (loading) {
       toast.error("Please wait for the current image generation to complete.");
       return;
    }
     // Clear the specific image
     setGeneratedImages(prev => {
       const updated = [...prev];
       updated[index] = ""; // Clear the image string
       return updated;
     });
     // Set the index and trigger generation for this specific image
     setCurrentImageIndex(index);
     // Use setTimeout to ensure state update before calling generate
     setTimeout(() => generateNextImage(index), 0);
  };

  // Function to open the modal
  const handleImageClick = (index: number) => {
     const promptData = editablePrompts[index];
     const imageSrc = generatedImages[index];
     if (!promptData) return;

     setSelectedImageData({
       src: imageSrc && imageSrc !== "NSFW_PLACEHOLDER" ? imageSrc : null,
       prompt: promptData.imagePrompt,
       transcriptSegment: promptData.transcriptSegment, // Pass transcript segment
       timestamp: promptData.timestamp,
       index: index,
       isNsfwPlaceholder: imageSrc === "NSFW_PLACEHOLDER",
     });
     setIsModalOpen(true);
  };

  // Function to handle regeneration request from modal
  const handleModalRegenerate = (index: number) => {
     setIsModalOpen(false); // Close modal first
     handleRegenerateImage(index); // Trigger regeneration
  };


  const handleContinue = () => {
    // Check if all images are generated (excluding placeholders)
    const allGenerated = generatedImages.length === totalImages && generatedImages.every(img => img && img !== "NSFW_PLACEHOLDER");
    if (allGenerated) {
      // Filter out any potential placeholders before passing on
      onImagesGenerated(generatedImages.filter(img => img !== "NSFW_PLACEHOLDER"));
    } else if (loading) {
       toast.error("Please wait for all images to be generated.");
    } else {
       toast.error("Some images failed to generate (e.g., NSFW). Please regenerate them or edit prompts before continuing.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">
          Image Generation ({generatedImages.filter(img => img && img !== "NSFW_PLACEHOLDER").length}/{totalImages})
        </h2>
        <p className="text-gray-400 mt-2">
          Generating images sequentially...
        </p>
      </div>

      {/* Progress bar for sequential generation */}
       <div className="w-full bg-gray-700 rounded-full h-2.5 dark:bg-gray-700">
         <div
           className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2.5 rounded-full transition-all duration-300 ease-out"
           style={{ width: `${progress}%` }}
         ></div>
       </div>

      {error && (
        <div className="text-center text-red-500 p-3 bg-red-900/20 border border-red-900 rounded-lg">
          Error: {error} {/* Display error message */}
        </div>
      )}

      {/* Remove general loading indicator, handled per image */}

      {/* Updated Grid Layout: 6 columns on medium screens and up */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Map over editablePrompts which holds the original structure */}
        {editablePrompts.map((promptData, index) => {
          // Determine content for the grid cell
          let cellContent;
          if (generatedImages[index] && generatedImages[index] !== "NSFW_PLACEHOLDER") {
            cellContent = (
              <Image
                src={generatedImages[index]}
                alt={`Generated image ${index + 1}`}
                fill
                style={{ objectFit: 'cover' }}
                priority={index < 6} // Prioritize first row
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16.6vw" // Adjusted sizes
              />
            );
          } else if (generatedImages[index] === "NSFW_PLACEHOLDER") {
            cellContent = (
              <div className="flex flex-col items-center justify-center text-center p-1">
                <span className="text-yellow-400 text-[10px] font-semibold leading-tight">NSFW<br/>Detected</span>
              </div>
            );
          } else if (loading && currentImageIndex === index) {
            cellContent = (
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
              </div>
            );
          } else {
            cellContent = <span className="text-gray-500 text-xs">Pending</span>;
          }

          return (
            <div
              key={promptData.timestamp} // Use timestamp as key if unique
              className="aspect-video bg-gray-800 rounded-lg border border-gray-700 overflow-hidden group relative cursor-pointer"
              onClick={() => handleImageClick(index)} // Add onClick handler
            >
              {/* Tooltip showing timestamp on hover */}
              <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                 {promptData.timestamp.toFixed(1)}s
              </div>

              {/* Glowing outline on hover - Ensure opacity transition works */}
              <div className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 box-glow-strong pointer-events-none"></div> 
              {/* Added pointer-events-none to prevent outline from blocking clicks */}

              {/* Display generated image, placeholder, or loading state - adjusted container */}
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                {cellContent}
              </div>
              {/* Removed prompt text area and regenerate button from here */}
            </div>
          );
        })}
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-2 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
          disabled={loading} // Disable back button while loading
        >
          Back
        </button>
        {/* Removed Regenerate All button */}
        <button
          onClick={handleContinue}
          className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          // Disable continue if loading OR if not all images are successfully generated
          disabled={loading || generatedImages.length < totalImages || generatedImages.some(img => !img || img === "NSFW_PLACEHOLDER")}
        >
          Continue
        </button>
      </div>

      {/* Render the Modal */}
      <ImageFocusModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageData={selectedImageData}
        onRegenerate={handleModalRegenerate}
        isLoading={loading && currentImageIndex === selectedImageData?.index} // Pass loading state for the specific image
      />
    </div>
  );
};

export default ImageGeneration;
