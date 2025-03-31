/**
 * Kling v1.6 Standard Model Reference
 * Source: https://replicate.com/kwaivgi/kling-v1.6-standard/api
 */

export const klingModelReference = {
  modelId: "kwaivgi/kling-v1.6-standard",
  latestVersion: "7e324e5fcb9479696f15ab6da262390cddf5a1efa2e11374ef9d1f85fc0f82da",
  description: "Text-to-motion framework for image animation",
  
  parameters: {
    // Required parameters
    prompt: {
      type: "string",
      description: "Text description of the desired motion",
      required: true,
      example: "zoom in slowly"
    },
    start_image: {
      type: "string",
      description: "Base64 encoded image or URL to animate",
      required: true,
      notes: "Must be at least 300x300 pixels"
    },
    
    // Optional parameters
    duration: {
      type: "number",
      description: "Length of the generated video in seconds",
      default: 5,
      options: [5, 10]
    },
    cfg_scale: {
      type: "number",
      description: "Controls adherence to prompt vs. creative freedom",
      default: 0.5,
      range: [0, 1]
    },
    aspect_ratio: {
      type: "string",
      description: "Aspect ratio of the output video",
      default: "16:9",
      options: ["16:9", "9:16", "1:1"]
    },
    negative_prompt: {
      type: "string",
      description: "Text description of what to avoid in the motion",
      default: "",
      required: false
    }
  },
  
  usage: {
    // Sample API usage
    sampleInput: {
      prompt: "zoom in slowly with a gentle camera movement",
      start_image: "[base64 image string or image URL]",
      duration: 5,
      cfg_scale: 0.5,
      aspect_ratio: "16:9",
      negative_prompt: ""
    },
    
    sampleOutput: {
      urls: {
        mp4: "[URL to generated MP4]",
        webm: "[URL to generated WebM]",
        gif: "[URL to generated GIF]"
      }
    }
  },
  
  notes: [
    "The model works best with clear, descriptive motion prompts",
    "Higher cfg_scale values make the model follow the prompt more closely",
    "Lower cfg_scale values allow for more creative interpretation",
    "The input image must be properly formatted and sized",
    "Processing can take 30-60 seconds depending on settings"
  ]
}; 