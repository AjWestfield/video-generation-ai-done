      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <video 
            controls 
            className="absolute top-0 left-0 w-full h-full object-contain bg-black" 
            src={videoUrl}
            poster="/video-poster.png"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 