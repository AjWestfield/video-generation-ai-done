'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

export default function ImageAnimator() {
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animatedVideo, setAnimatedVideo] = useState<string | null>(null);
  const [motionPrompt, setMotionPrompt] = useState('zoom in slowly with gentle camera movement');
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setAnimatedVideo(null);
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Only allow image files
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    
    // Read the selected file as a data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!image) {
      setError('Please select an image first.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setAnimatedVideo(null);
    
    try {
      // Start the animation process
      const response = await fetch('/api/animate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: image,
          motionPrompt: motionPrompt
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start animation process');
      }
      
      // Store the prediction ID
      const id = data.predictionIds?.[0];
      if (!id) {
        throw new Error('No prediction ID returned from server');
      }
      
      setPredictionId(id);
      
      // Start polling for results
      startPolling(id);
      
    } catch (err: any) {
      setError(err.message || 'Failed to animate image');
      setIsLoading(false);
    }
  };
  
  // Poll for animation status
  const startPolling = (id: string) => {
    // Clear any existing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/animate/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ predictionId: id }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to check animation status');
        }
        
        // If complete, show the animated video
        if (data.status === 'complete') {
          clearInterval(pollIntervalRef.current!);
          setAnimatedVideo(data.output);
          setIsLoading(false);
        } 
        // If failed, show error
        else if (data.status === 'failed') {
          clearInterval(pollIntervalRef.current!);
          setError(data.error || 'Animation generation failed');
          setIsLoading(false);
        }
        // Otherwise, continue polling
        
      } catch (err: any) {
        clearInterval(pollIntervalRef.current!);
        setError(err.message || 'Failed to check animation status');
        setIsLoading(false);
      }
    }, 3000);
  };
  
  // Clean up interval on unmount
  const resetForm = () => {
    setImage(null);
    setAnimatedVideo(null);
    setError(null);
    setPredictionId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Image Animator</h1>
      <p className="mb-4 text-gray-600">
        Upload an image and add a motion prompt to animate it using the Kling model
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Select Image (300x300 pixels or larger)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="block w-full text-sm border border-gray-300 rounded px-3 py-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">
            Motion Prompt
          </label>
          <input
            type="text"
            value={motionPrompt}
            onChange={(e) => setMotionPrompt(e.target.value)}
            placeholder="Describe the motion (e.g., zoom in slowly)"
            className="block w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        
        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={isLoading || !image}
            className={`px-4 py-2 rounded ${
              isLoading || !image
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isLoading ? 'Animating...' : 'Animate Image'}
          </button>
          
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          >
            Reset
          </button>
        </div>
      </form>
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {image && (
          <div>
            <h2 className="text-lg font-medium mb-2">Original Image</h2>
            <div className="relative h-64 border border-gray-300 rounded overflow-hidden">
              <Image
                src={image}
                alt="Original image"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{ objectFit: 'contain' }}
              />
            </div>
          </div>
        )}
        
        {animatedVideo && (
          <div>
            <h2 className="text-lg font-medium mb-2">Animated Result</h2>
            <div className="border border-gray-300 rounded overflow-hidden">
              <video
                controls
                autoPlay
                loop
                className="w-full h-64 object-contain"
                src={animatedVideo}
              />
            </div>
          </div>
        )}
        
        {isLoading && (
          <div className="md:col-span-2 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Generating animation... This may take 30-60 seconds.</p>
              {predictionId && (
                <p className="text-xs text-gray-500 mt-2">
                  Prediction ID: {predictionId}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 