"use client";

import { useState } from "react";
import VideoIdeaForm from "../components/VideoIdeaForm";
import ScriptGeneration from "../components/ScriptGeneration";
import VoiceoverGeneration from "../components/VoiceoverGeneration";
import ImagePromptGeneration from "../components/ImagePromptGeneration";
import ImageGeneration from "../components/ImageGeneration";
import TimedImageGeneration from "../components/TimedImageGeneration";
import VideoGeneration from "../components/VideoGeneration";
import VideoPreview from "../components/VideoPreview";
import ProgressStepper from "../components/ProgressStepper";
import { Toaster } from "react-hot-toast";

export default function Home() {
  // Define the workflow states
  const [currentStep, setCurrentStep] = useState(0);
  const [videoIdea, setVideoIdea] = useState("");
  const [videoDuration, setVideoDuration] = useState(1); // Default 1 minute
  const [scriptData, setScriptData] = useState<any>(null);
  const [voiceoverData, setVoiceoverData] = useState<any>(null);
  const [imagePrompts, setImagePrompts] = useState<any[]>([]);
  const [timedImages, setTimedImages] = useState<{ timestamp: number; imageBase64: string }[]>([]);
  const [imageData, setImageData] = useState<string[]>([]);
  const [videoData, setVideoData] = useState<any>(null);

  // Steps of the workflow
  const steps = [
    "Video Idea",
    "Script Generation",
    "Voiceover Generation",
    "Image Generation",
    "Video Creation",
  ];

  // Handle form submission for video idea
  const handleVideoIdeaSubmit = (idea: string, duration: number) => {
    setVideoIdea(idea);
    setVideoDuration(duration);
    setCurrentStep(1);
  };

  // Handle script generation completion
  const handleScriptGenerated = (data: any) => {
    setScriptData(data);
    setCurrentStep(2);
  };

  // Handle voiceover generation completion
  const handleVoiceoverGenerated = (data: any) => {
    setVoiceoverData(data);
    // Update script data if it was edited in the voiceover generation step
    if (data.script && data.script !== scriptData.script) {
      setScriptData({
        ...scriptData,
        script: data.script
      });
    }
    setCurrentStep(3);
  };

  // Handle timed images generation completion
  const handleTimedImagesGenerated = (images: { timestamp: number; imageBase64: string }[]) => {
    setTimedImages(images);
    
    // Extract just the base64 images for the video generation step
    const imageStrings = images.map(img => img.imageBase64);
    setImageData(imageStrings);
    
    setCurrentStep(4);
  };

  // Handle video generation completion
  const handleVideoGenerated = (data: any) => {
    setVideoData(data);
    setCurrentStep(5);
  };

  // Reset the workflow
  const handleReset = () => {
    setVideoIdea("");
    setVideoDuration(1);
    setScriptData(null);
    setVoiceoverData(null);
    setImagePrompts([]);
    setTimedImages([]);
    setImageData([]);
    setVideoData(null);
    setCurrentStep(0);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 lg:p-12 bg-gradient-to-br from-gray-900 to-slate-900">
      <Toaster position="top-center" />
      
      <div className="container max-w-5xl mx-auto space-y-8">
        <header className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600">
            AI Video Creator
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Transform your ideas into stunning videos with the power of AI. Just enter your concept and watch it come to life.
          </p>
        </header>

        <ProgressStepper 
          steps={steps} 
          currentStep={currentStep} 
          onStepClick={(step) => {
            // Only allow going back to previous steps, not skipping ahead
            if (step < currentStep) {
              setCurrentStep(step);
            }
          }} 
        />

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 md:p-6 lg:p-8 shadow-xl border border-gray-700">
          {currentStep === 0 && (
            <VideoIdeaForm onSubmit={handleVideoIdeaSubmit} />
          )}
          
          {currentStep === 1 && (
            <ScriptGeneration 
              videoIdea={videoIdea}
              videoDuration={videoDuration}
              onScriptGenerated={handleScriptGenerated}
              onBack={() => setCurrentStep(0)}
            />
          )}
          
          {currentStep === 2 && scriptData && (
            <VoiceoverGeneration 
              script={scriptData.script} 
              onVoiceoverGenerated={handleVoiceoverGenerated}
              onBack={() => setCurrentStep(1)}
              autoGenerate={false}
            />
          )}
          
          {currentStep === 3 && scriptData && voiceoverData && (
            <TimedImageGeneration 
              script={scriptData.script}
              audioBase64={voiceoverData.audioBase64}
              onImagesGenerated={handleTimedImagesGenerated}
              onBack={() => setCurrentStep(2)}
            />
          )}
          
          {currentStep === 4 && imageData.length > 0 && (
            <VideoGeneration 
              images={imageData} 
              audioBase64={voiceoverData.audioBase64}
              timedImages={timedImages}
              onVideoGenerated={handleVideoGenerated}
              onBack={() => setCurrentStep(3)}
            />
          )}
          
          {currentStep === 5 && videoData && (
            <VideoPreview 
              videoUrl={videoData.videoUrl} 
              onReset={handleReset}
            />
          )}
        </div>
      </div>
    </main>
  );
}
