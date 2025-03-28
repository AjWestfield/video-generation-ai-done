          <div className="space-y-4 max-h-64 overflow-y-auto">
            {generatedImages.map((image, index) => (
              <div
                key={index}
                className="p-3 rounded bg-gray-800 border border-gray-700"
              >
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Timestamp: {formatTimestamp(image.timestamp)}</span>
                </div>
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <img 
                    src={image.imageBase64} 
                    alt={`Image at ${formatTimestamp(image.timestamp)}`} 
                    className="absolute top-0 left-0 w-full h-full object-cover rounded"
                  />
                </div>
              </div>
            ))}
          </div> 