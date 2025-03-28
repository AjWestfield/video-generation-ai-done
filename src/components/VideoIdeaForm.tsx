import React, { useState } from "react";

interface VideoIdeaFormProps {
  onSubmit: (idea: string, duration: number) => void;
}

const VideoIdeaForm: React.FC<VideoIdeaFormProps> = ({ onSubmit }) => {
  const [idea, setIdea] = useState("");
  const [duration, setDuration] = useState(1); // Default to 1 minute
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (idea.trim().length < 10) {
      setError("Please provide a more detailed idea (at least 10 characters)");
      return;
    }
    
    setError("");
    onSubmit(idea, duration);
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

        <div>
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

export default VideoIdeaForm; 