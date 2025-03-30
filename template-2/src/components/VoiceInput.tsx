'use client';

import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

// Define structure for the data passed to the next step
interface TranscriptPromptData {
  start: number;
  end: number;
  transcriptSegment: string;
  imagePrompt: string;
}

interface VoiceInputProps {
  onProcessingComplete: (data: {
    voiceoverAudioUrl: string;
    promptsData: TranscriptPromptData[];
  }) => void;
  // Add onBack prop if needed for navigation
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onProcessingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleStartRecording = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        setStatusMessage('Requesting microphone permission...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStatusMessage('Microphone access granted. Starting recording...');
        setIsRecording(true);
        setAudioBlob(null); // Clear previous recording
        setAudioUrl(null);
        audioChunksRef.current = [];

        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };
        mediaRecorderRef.current.onstop = () => {
          const completeBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); // Or appropriate type
          setAudioBlob(completeBlob);
          const url = URL.createObjectURL(completeBlob);
          setAudioUrl(url);
          setStatusMessage('Recording stopped. Ready to process.');
          // Automatically process after stopping
          processAudio(completeBlob, url);
        };
        mediaRecorderRef.current.start();
        setStatusMessage('Recording...');
      } catch (err) {
        console.error('Error accessing microphone:', err);
        setStatusMessage('Error: Could not access microphone.');
        toast.error('Could not access microphone. Please check permissions.');
        setIsRecording(false);
      }
    } else {
      setStatusMessage('Error: Audio recording not supported by this browser.');
      toast.error('Audio recording not supported by this browser.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      // Stop microphone tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      // Processing will be triggered by onstop handler
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioBlob(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setStatusMessage(`File "${file.name}" selected. Ready to process.`);
      // Automatically process after upload
      processAudio(file, url);
    }
  };

  // Function to convert Blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string)?.split(',')[1]; // Remove data:audio/...;base64, prefix
        if (base64String) {
          resolve(base64String);
        } else {
          reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Process audio: Transcribe -> Generate Prompts
  const processAudio = async (blob: Blob, audioPreviewUrl: string) => {
    setIsLoading(true);
    setStatusMessage('Converting audio...');
    try {
      const base64Audio = await blobToBase64(blob);
      setStatusMessage('Transcribing audio...');

      // 1. Call Transcription API
      const transcribeResponse = await fetch('/api/openai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio }),
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(`Transcription failed: ${errorData.error || transcribeResponse.statusText}`);
      }
      const transcriptionData = await transcribeResponse.json();
      const segments = transcriptionData.segments;

      if (!segments || segments.length === 0) {
        throw new Error('Transcription returned no segments.');
      }
      setStatusMessage('Generating image prompts...');

      // 2. Call Prompt Generation API
      const promptGenResponse = await fetch('/api/openrouter/generate-prompts-from-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments }), // Pass the segments directly
      });

      if (!promptGenResponse.ok) {
        const errorData = await promptGenResponse.json();
        throw new Error(`Prompt generation failed: ${errorData.error || promptGenResponse.statusText}`);
      }
      const promptGenData = await promptGenResponse.json();
      const promptsData: TranscriptPromptData[] = promptGenData.prompts;

      if (!promptsData || promptsData.length === 0) {
        throw new Error('Prompt generation returned no prompts.');
      }
      setStatusMessage('Processing complete!');
      toast.success('Transcription and prompts generated!');

      // 3. Pass data to parent component
      onProcessingComplete({ voiceoverAudioUrl: audioPreviewUrl, promptsData });

    } catch (error) {
      console.error('Error processing audio:', error);
      setStatusMessage(`Error: ${(error as Error).message}`);
      toast.error(`Processing failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="space-y-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
      <h2 className="text-xl font-semibold text-white text-center">Provide Voiceover</h2>
      <p className="text-sm text-gray-400 text-center">Record your voiceover directly or upload an audio file.</p>

      {/* Recording Controls */}
      <div className="text-center">
        <button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isLoading}
          className={`px-6 py-3 rounded-full text-white font-bold transition-colors ${
            isLoading ? 'bg-gray-600 cursor-not-allowed' :
            isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Processing...' : isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        {isRecording && <p className="text-sm text-yellow-400 mt-2 animate-pulse">Recording...</p>}
      </div>

      {/* File Upload */}
      <div className="text-center">
        <label htmlFor="audio-upload" className={`inline-block px-6 py-3 rounded-full text-white font-bold transition-colors cursor-pointer ${isLoading ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>
          Upload Audio File
        </label>
        <input
          id="audio-upload"
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          disabled={isLoading || isRecording}
          className="hidden"
        />
         <p className="text-xs text-gray-500 mt-1">(.wav, .mp3, .ogg, etc.)</p>
      </div>

       {/* Status & Preview */}
       {statusMessage && (
         <p className={`text-sm text-center ${isLoading ? 'text-yellow-400' : 'text-gray-300'}`}>{statusMessage}</p>
       )}
       {audioUrl && !isLoading && (
         <div className="mt-4 p-3 bg-gray-700 rounded-lg">
           <p className="text-sm text-white mb-2">Audio Preview:</p>
           <audio controls src={audioUrl} className="w-full">
             Your browser does not support the audio element.
           </audio>
         </div>
       )}

       {/* Loading Indicator */}
       {isLoading && (
         <div className="flex justify-center items-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            <p className="ml-3 text-gray-300">Processing audio...</p>
         </div>
       )}

       {/* TODO: Add Back button if needed */}

    </div>
  );
};

export default VoiceInput;
