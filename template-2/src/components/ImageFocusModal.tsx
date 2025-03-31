import React from 'react';
import Image from 'next/image';

interface ImageFocusModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageData: {
    src: string | null; // Base64 image data or null if placeholder/error
    prompt: string;
    transcriptSegment: string; // Need to get this from somewhere
    timestamp: number;
    index: number; // Index for regeneration
    isNsfwPlaceholder: boolean;
  } | null;
  onRegenerate: (index: number) => void;
  isLoading: boolean; // To disable regenerate button while loading
}

const ImageFocusModal: React.FC<ImageFocusModalProps> = ({
  isOpen,
  onClose,
  imageData,
  onRegenerate,
  isLoading,
}) => {
  if (!isOpen || !imageData) {
    return null;
  }

  const handleRegenerateClick = () => {
    if (!isLoading) {
      onRegenerate(imageData.index);
      // Optionally close the modal after clicking regenerate, or keep it open to show loading
      // onClose(); 
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
      onClick={onClose} // Close modal on backdrop click
    >
      {/* Increased max-width for larger modal */}
      <div 
        className="bg-glass-darker rounded-lg shadow-xl p-4 md:p-6 max-w-5xl w-full border border-[rgba(var(--accent-blue),0.2)] box-glow relative" 
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors z-10"
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Adjusted layout for larger image */}
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Image Display - Increased width */}
          <div className="w-full lg:w-2/3 aspect-video bg-gray-900 rounded-lg border border-gray-700 overflow-hidden flex items-center justify-center">
            {imageData.src && !imageData.isNsfwPlaceholder ? (
              <Image
                src={imageData.src}
                alt={`Focused image for timestamp ${imageData.timestamp.toFixed(1)}s`}
                width={1280} // Increased size hint
                height={720}
                style={{ objectFit: 'contain', maxWidth: '100%', maxHeight: '100%' }} 
                priority 
              />
            ) : imageData.isNsfwPlaceholder ? (
               <div className="flex flex-col items-center justify-center text-center p-4">
                 <span className="text-yellow-400 text-lg font-semibold">NSFW Detected</span>
                 <span className="text-gray-300 text-sm mt-2">The generated content was flagged as potentially unsafe.</span>
               </div>
            ) : (
              <span className="text-gray-500">Image not available</span>
            )}
          </div>

          {/* Details Section - Adjusted width */}
          <div className="w-full lg:w-1/3 space-y-3 text-sm">
            <h3 className="text-lg font-semibold text-[rgba(var(--accent-cyan),1)]">Image Details</h3>
            
            <div>
              <label className="font-medium text-gray-300 block mb-1">Timestamp:</label>
              <p className="text-gray-400 bg-gray-800/50 p-2 rounded border border-gray-700">{imageData.timestamp.toFixed(2)}s</p>
            </div>

            <div>
              <label className="font-medium text-gray-300 block mb-1">Transcript Segment:</label>
              {/* TODO: Need to pass the actual transcript segment here */}
              <p className="text-gray-400 bg-gray-800/50 p-2 rounded border border-gray-700 h-20 overflow-y-auto custom-scrollbar">
                {imageData.transcriptSegment || "Transcript segment not available."} 
              </p>
            </div>

            <div>
              <label className="font-medium text-gray-300 block mb-1">Generated Prompt:</label>
              <p className="text-gray-400 bg-gray-800/50 p-2 rounded border border-gray-700 h-20 overflow-y-auto custom-scrollbar">{imageData.prompt}</p>
            </div>

            <button
              onClick={handleRegenerateClick}
              className="w-full mt-2 py-2 px-4 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Generating...' : 'Regenerate Image'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageFocusModal;
