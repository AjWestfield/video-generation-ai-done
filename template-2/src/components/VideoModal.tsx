'use client';

import React, { useEffect, useRef } from 'react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  prompt: string;
}

const VideoModal: React.FC<VideoModalProps> = ({ isOpen, onClose, videoUrl, prompt }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden'; // Prevent scrolling
      
      // Auto-play video when modal opens
      if (videoRef.current) {
        videoRef.current.play().catch(err => console.error('Failed to autoplay video:', err));
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'auto'; // Re-enable scrolling
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm">
      <div 
        ref={modalRef} 
        className="relative bg-glass border border-[rgba(var(--accent-blue),0.3)] rounded-lg shadow-xl max-w-4xl w-full mx-4 overflow-hidden"
      >
        <div className="relative">
          <video 
            ref={videoRef} 
            src={videoUrl} 
            controls 
            autoPlay 
            loop 
            playsInline 
            className="w-full h-auto max-h-[80vh]"
          />
          <button 
            onClick={onClose}
            className="absolute top-2 right-2 p-2 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 bg-[rgba(20,25,45,0.8)]">
          <h3 className="text-lg font-medium text-white mb-2">Motion Prompt</h3>
          <p className="text-gray-200 italic">{prompt}</p>
        </div>
      </div>
    </div>
  );
}

export default VideoModal; 