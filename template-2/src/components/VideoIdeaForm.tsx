import React, { useState } from "react";

interface VideoIdeaFormProps {
  onSubmit: (idea: string, duration: number, narrativeMode: boolean, storyStructure: string) => void;
}

const VideoIdeaForm: React.FC<VideoIdeaFormProps> = ({ onSubmit }) => {
  const [idea, setIdea] = useState("");
  const [duration, setDuration] = useState(1); // Default to 1 minute
  const [error, setError] = useState("");
  const [narrativeMode, setNarrativeMode] = useState(false);
  const [storyStructure, setStoryStructure] = useState("standard");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (idea.trim().length < 10) {
      setError("Please provide a more detailed idea (at least 10 characters)");
      return;
    }
    
    setError("");
    onSubmit(idea, duration, narrativeMode, storyStructure);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold text-white">What's your video idea?</h2>
        <p className="text-gray-400">
          Be as descriptive as possible. The more details you provide, the better the AI can understand your vision.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="For example: A short educational video explaining how black holes form in space, with visuals that make it easy to understand for high school students."
            rows={6}
            className="w-full p-4 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
          />
          {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="duration" className="block text-sm font-medium text-gray-400 mb-2">
              Video Duration
            </label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
            >
              <option value={1}>1 minute (~180 words)</option>
              <option value={3}>3 minutes (~540 words)</option>
              <option value={5}>5 minutes (~900 words)</option>
              <option value={10}>10 minutes (~1800 words)</option>
            </select>
            <p className="mt-2 text-sm text-gray-500">Select the target duration for your video script</p>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Script Style
            </label>
            <div className="p-3 bg-gray-900 border border-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Storytelling Mode</span>
                <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
                  <input
                    type="checkbox"
                    name="toggle"
                    id="narrative-toggle"
                    checked={narrativeMode}
                    onChange={() => setNarrativeMode(!narrativeMode)}
                    className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer"
                  />
                  <label
                    htmlFor="narrative-toggle"
                    className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${
                      narrativeMode ? 'bg-[rgba(var(--accent-purple),0.8)]' : 'bg-gray-600'
                    }`}
                  ></label>
                </div>
              </div>
              
              {narrativeMode && (
                <div className="mt-3">
                  <label htmlFor="story-structure" className="block text-xs text-gray-400 mb-1">
                    Story Structure
                  </label>
                  <select
                    id="story-structure"
                    value={storyStructure}
                    onChange={(e) => setStoryStructure(e.target.value)}
                    className="w-full p-2 bg-gray-800 text-sm text-gray-200 rounded border border-gray-700 focus:outline-none focus:ring-1 focus:ring-[rgba(var(--accent-purple),0.5)]"
                  >
                    <option value="standard">Three-Act Structure</option>
                    <option value="hero">Hero's Journey</option>
                    <option value="problem">Problem-Solution</option>
                    <option value="inverted">Inverted Pyramid</option>
                    <option value="circular">Circular Narrative</option>
                  </select>
                  <p className="mt-1 text-xs text-[rgba(var(--accent-purple),0.7)]">
                    {getStoryStructureDescription(storyStructure)}
                  </p>
                </div>
              )}
            </div>
            {!narrativeMode && (
              <p className="mt-2 text-sm text-gray-500">Enable storytelling for narrative-focused scripts</p>
            )}
          </div>
        </div>

        <div className="examples space-y-3">
          <p className="text-sm text-gray-400 font-medium">Example ideas:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              "A travel montage showcasing the breathtaking landscapes of Iceland",
              "A step-by-step cooking tutorial for making perfect homemade pasta",
              "An overview of the latest advancements in renewable energy technology",
              "A motivational video about overcoming challenges and achieving goals"
            ].map((example, i) => (
              <div 
                key={i}
                onClick={() => setIdea(example)}
                className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-gray-300 cursor-pointer hover:bg-gray-800 transition-colors"
              >
                {example}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all"
          >
            Generate Video
          </button>
        </div>
      </form>
    </div>
  );
};

// Helper function to get a friendly description for the story structure
function getStoryStructureDescription(structure: string): string {
  const structureDescriptions: {[key: string]: string} = {
    standard: "Classic beginning, middle, and end structure",
    hero: "Character transformation and growth journey",
    problem: "Presents challenge then builds to solution",
    inverted: "Most important info first, details follow",
    circular: "Begins and ends at the same place with new insight"
  };
  
  return structureDescriptions[structure] || "";
}

export default VideoIdeaForm; 