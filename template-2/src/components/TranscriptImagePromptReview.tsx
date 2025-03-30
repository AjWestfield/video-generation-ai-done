import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// Define the structure for the data this component will receive
interface TranscriptPromptData {
  start: number;
  end: number;
  transcriptSegment: string;
  imagePrompt: string;
}

// Define the structure expected from the prompt generation API
interface PromptResult {
  start: number;
  end: number;
  transcriptSegment: string;
  imagePrompt: string;
}


interface TranscriptImagePromptReviewProps {
  // Props will be added here:
  // - voiceoverAudioUrl: string (or Blob/File)
  // - initialPromptsData: TranscriptPromptData[]
  voiceoverAudioUrl: string; // URL for the audio player
  initialPromptsData: TranscriptPromptData[];
  onPromptsFinalized: (finalPrompts: { timestamp: number; imagePrompt: string }[]) => void;
  onBack: () => void;
}

const TranscriptImagePromptReview: React.FC<TranscriptImagePromptReviewProps> = ({
  voiceoverAudioUrl,
  initialPromptsData,
  onPromptsFinalized,
  onBack,
}) => {
  const [promptsData, setPromptsData] = useState<TranscriptPromptData[]>(initialPromptsData);
  const [isLoading, setIsLoading] = useState(false); // For regeneration loading state

  // Update state if initial data changes (e.g., regeneration)
  useEffect(() => {
    setPromptsData(initialPromptsData);
  }, [initialPromptsData]);

  const handlePromptChange = (index: number, newPrompt: string) => {
    setPromptsData(currentData =>
      currentData.map((item, i) =>
        i === index ? { ...item, imagePrompt: newPrompt } : item
      )
    );
    // Removed extra );
  };

  const handleRegenerateSingle = async (index: number) => {
    const segmentToRegenerate = promptsData[index];
    if (!segmentToRegenerate) return;

    setIsLoading(true);
    toast.loading(`Regenerating prompt ${index + 1}...`);

    try {
      const response = await fetch('/api/openrouter/generate-prompts-from-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send only the single segment that needs regeneration
        body: JSON.stringify({ segments: [segmentToRegenerate] }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate prompt');
      }

      const data = await response.json();
      const regeneratedPromptData = data.prompts?.[0]; // API returns an array

      if (regeneratedPromptData?.imagePrompt) {
        setPromptsData(currentData =>
          currentData.map((item, i) =>
            i === index ? { ...item, imagePrompt: regeneratedPromptData.imagePrompt } : item
          )
        );
        toast.dismiss();
        toast.success(`Prompt ${index + 1} regenerated!`);
      } else {
        throw new Error('Invalid response from regeneration API');
      }
    } catch (error) {
      console.error('Error regenerating single prompt:', error);
      toast.dismiss();
      toast.error(`Failed to regenerate prompt ${index + 1}: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateAll = async () => {
    setIsLoading(true);
    toast.loading('Regenerating all prompts...');

    try {
       // Prepare segments data (only need text, start, end for regeneration)
       const segmentsToRegenerate = promptsData.map(p => ({
         start: p.start,
         end: p.end,
         text: p.transcriptSegment,
       }));

      const response = await fetch('/api/openrouter/generate-prompts-from-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: segmentsToRegenerate }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate prompts');
      }

      const data = await response.json();
      const regeneratedPrompts: PromptResult[] = data.prompts;

      if (regeneratedPrompts && regeneratedPrompts.length === promptsData.length) {
         // Update the state with all new prompts, matching by start time
         setPromptsData(currentData =>
           currentData.map((currentItem) => {
             const matchingNewPrompt = regeneratedPrompts.find(newItem => newItem.start === currentItem.start);
             return matchingNewPrompt ? { ...currentItem, imagePrompt: matchingNewPrompt.imagePrompt } : currentItem;
           })
         );
        toast.dismiss();
        toast.success('All prompts regenerated!');
      } else {
        throw new Error('Mismatch in regenerated prompts count or invalid response');
      }
    } catch (error) {
      console.error('Error regenerating all prompts:', error);
      toast.dismiss();
      toast.error(`Failed to regenerate all prompts: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    // Pass the finalized prompts (mapping timestamp to start time for consistency)
    onPromptsFinalized(promptsData.map(p => ({ timestamp: p.start, imagePrompt: p.imagePrompt })));
    console.log('Continue clicked');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white text-center">Review Transcript and Image Prompts</h2>

      {/* Audio Player */}
      {voiceoverAudioUrl && (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <audio controls src={voiceoverAudioUrl} className="w-full">
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Regenerate All Button */}
       <button
          onClick={handleRegenerateAll}
          className="w-full py-2 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          disabled={isLoading}
        >
          {isLoading ? 'Regenerating...' : 'Regenerate All Prompts'}
        </button>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto p-2 rounded bg-gray-900/50">
        {promptsData && promptsData.length > 0 ? (
          promptsData.map((item, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-2">
              <p className="text-xs font-mono text-gray-500">
                Time: {item.start.toFixed(2)}s - {item.end.toFixed(2)}s
              </p>
              {/* Display transcript segment without literal quotes in JSX */}
              <p className="text-sm text-gray-300 italic">
                &ldquo;{item.transcriptSegment}&rdquo;
              </p>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Image Prompt:</label>
                <textarea
                  value={item.imagePrompt}
                  onChange={(e) => handlePromptChange(index, e.target.value)}
                  className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
                  rows={3}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={() => handleRegenerateSingle(index)}
                className="w-full py-1 px-3 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                disabled={isLoading}
              >
                Regenerate This Prompt
              </button>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500">Loading prompts data...</p>
        )}
      </div>

      <div className="flex gap-4">
         <button
            onClick={onBack} // Connect the onBack prop
            className="flex-1 py-2 px-4 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
            disabled={isLoading} // Disable if loading
          >
            Back
          </button>
        <button
          onClick={handleContinue}
          className="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          disabled={isLoading}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default TranscriptImagePromptReview;
