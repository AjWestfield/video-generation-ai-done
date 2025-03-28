import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface ImageSection {
  scriptSection: string;
  imagePrompt: string;
}

interface ImageGenerationProps {
  imageSections: ImageSection[];
  onImagesGenerated: (images: string[]) => void;
  onBack: () => void;
}

const ImageGeneration: React.FC<ImageGenerationProps> = ({
  imageSections,
  onImagesGenerated,
  onBack,
}) => {
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<string[]>(
    imageSections.map((section) => section.imagePrompt)
  );

  const totalImages = imageSections.length;
  const progress = Math.round((generatedImages.length / totalImages) * 100);

  useEffect(() => {
    if (imageSections.length > 0 && generatedImages.length === 0) {
      generateNextImage();
    }
  }, []);

  const generateNextImage = async () => {
    if (currentImageIndex >= totalImages) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const prompt = editedPrompts[currentImageIndex];
      
      const response = await fetch("/api/replicate/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate image");
      }

      const data = await response.json();
      
      // Handle the Replicate output format (array of image URLs)
      if (data.output && Array.isArray(data.output) && data.output.length > 0) {
        // Fetch the image as base64 for easier handling
        const imageUrl = data.output[0];
        const imageResponse = await fetch(imageUrl);
        const blob = await imageResponse.blob();
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          
          setGeneratedImages((prev) => [...prev, base64data]);
          
          if (currentImageIndex + 1 < totalImages) {
            setCurrentImageIndex(currentImageIndex + 1);
            generateNextImage();
          } else {
            // All images generated, proceed to next step
            setLoading(false);
          }
        };
        reader.readAsDataURL(blob);
      } else {
        throw new Error("Invalid response from image generation API");
      }
    } catch (err) {
      console.error("Error generating image:", err);
      setError((err as Error).message);
      setLoading(false);
      toast.error(`Failed to generate image ${currentImageIndex + 1}. Please try again.`);
    }
  };

  const handleEditPrompt = (index: number, newPrompt: string) => {
    const updatedPrompts = [...editedPrompts];
    updatedPrompts[index] = newPrompt;
    setEditedPrompts(updatedPrompts);
  };

  const handleRegenerateImage = (index: number) => {
    // Remove the image at the specified index
    setGeneratedImages((prev) => prev.filter((_, i) => i !== index));
    setCurrentImageIndex(index);
    
    // Wait for state update before regenerating
    setTimeout(() => {
      generateNextImage();
    }, 100);
  };

  const handleContinue = () => {
    if (generatedImages.length === totalImages) {
      onImagesGenerated(generatedImages);
    } else {
      toast.error("Please wait for all images to be generated");
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">
          Image Generation ({generatedImages.length}/{totalImages})
        </h2>
        <p className="text-gray-400 mt-2">
          Generating images from your script sections...
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {error && (
        <div className="text-center text-red-500 p-3 bg-red-900/20 border border-red-900 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {imageSections.map((section, index) => (
          <div
            key={index}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-white">
                Image {index + 1}
              </h3>
              
              <div className="text-sm text-gray-400 line-clamp-2">
                <strong>Section:</strong> {section.scriptSection}
              </div>
              
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  Image Prompt:
                </label>
                <textarea
                  value={editedPrompts[index]}
                  onChange={(e) => handleEditPrompt(index, e.target.value)}
                  className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
                  rows={3}
                  disabled={loading && currentImageIndex <= index}
                />
              </div>
              
              {index < generatedImages.length ? (
                <div className="space-y-2">
                  <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                    <img
                      src={generatedImages[index]}
                      alt={`Generated image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => handleRegenerateImage(index)}
                    className="w-full py-2 px-4 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                    disabled={loading}
                  >
                    Regenerate
                  </button>
                </div>
              ) : loading && currentImageIndex === index ? (
                <div className="h-40 flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="text-sm text-gray-400">
                      Generating image...
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
                  <span className="text-gray-500">Waiting to generate...</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-2 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          disabled={loading || generatedImages.length !== totalImages}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default ImageGeneration; 