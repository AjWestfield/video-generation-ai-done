import React, { useState } from "react";
import toast from "react-hot-toast";

interface VideoPreviewProps {
  videoUrl: string;
  onReset: () => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ videoUrl, onReset }) => {
  const [copying, setCopying] = useState(false);

  const handleDownload = () => {
    // Create an anchor element to trigger download
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `ai-generated-video-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    toast.success("Download started!");
  };

  const handleCopyLink = async () => {
    try {
      setCopying(true);
      // Get the full URL including host
      const fullUrl = `${window.location.origin}${videoUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      toast.success("Video URL copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy URL to clipboard");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Your Video is Ready!</h2>
        <p className="text-gray-400 mt-2">
          Your AI-generated video has been created successfully. You can preview it below, download it, or share the link.
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <video 
            controls 
            className="absolute top-0 left-0 w-full h-full object-contain bg-black" 
            src={videoUrl}
            poster="/video-poster.png"
            width="1920"
            height="1080"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={handleDownload}
          className="py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors flex items-center justify-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Download Video
        </button>
        
        <button
          onClick={handleCopyLink}
          disabled={copying}
          className="py-3 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors flex items-center justify-center gap-2"
        >
          {copying ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-white"></div>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
          )}
          {copying ? "Copying..." : "Copy Video Link"}
        </button>
      </div>

      <div className="text-center pt-4">
        <button
          onClick={onReset}
          className="py-2 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors"
        >
          Create Another Video
        </button>
      </div>

      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 text-center">
        <p className="text-blue-200 text-sm">
          Want to share your creation? Don't forget to mention this was made with AI!
        </p>
      </div>
    </div>
  );
};

export default VideoPreview; 