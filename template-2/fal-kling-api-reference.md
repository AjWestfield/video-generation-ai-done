# Fal AI Kling API Reference (https://fal.ai/models/fal-ai/kling-video/v1.6/pro/image-to-video/api)

## Model Identifier

```
npm install --save @fal-ai/client
```

## Parameters

*Parameter section not automatically found. Manual inspection of HTML might be needed.*

## Code Examples

```
npm install --save @fal-ai/client
```

```
export FAL_KEY="YOUR_API_KEY"
```

```
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/kling-video/v1.6/pro/image-to-video", {
  input: {
    prompt: "A stylish woman walks down a Tokyo street filled with warm glowing neon and animated city signage. She wears a black leather jacket, a long red dress, and black boots, and carries a black purse.",
    image_url: "https://fal.media/files/panda/TuXlMwArpQcdYNCLAEM8K.webp"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```

```
import { fal } from "@fal-ai/client";

fal.config({
  credentials: "YOUR_FAL_KEY"
});
```

```
import { fal } from "@fal-ai/client";

const { request_id } = await fal.queue.submit("fal-ai/kling-video/v1.6/pro/image-to-video", {
  input: {
    prompt: "A stylish woman walks down a Tokyo street filled with warm glowing neon and animated city signage. She wears a black leather jacket, a long red dress, and black boots, and carries a black purse.",
    image_url: "https://fal.media/files/panda/TuXlMwArpQcdYNCLAEM8K.webp"
  },
  webhookUrl: "https://optional.webhook.url/for/results",
});
```

```
import { fal } from "@fal-ai/client";

const status = await fal.queue.status("fal-ai/kling-video/v1.6/pro/image-to-video", {
  requestId: "764cabcf-b745-4b3e-ae38-1200304cf45b",
  logs: true,
});
```

```
import { fal } from "@fal-ai/client";

const result = await fal.queue.result("fal-ai/kling-video/v1.6/pro/image-to-video", {
  requestId: "764cabcf-b745-4b3e-ae38-1200304cf45b"
});
console.log(result.data);
console.log(result.requestId);
```

```
import { fal } from "@fal-ai/client";

const file = new File(["Hello, World!"], "hello.txt", { type: "text/plain" });
const url = await fal.storage.upload(file);
```

```
{
  "prompt": "A stylish woman walks down a Tokyo street filled with warm glowing neon and animated city signage. She wears a black leather jacket, a long red dress, and black boots, and carries a black purse.",
  "image_url": "https://fal.media/files/panda/TuXlMwArpQcdYNCLAEM8K.webp",
  "duration": "5",
  "aspect_ratio": "16:9",
  "negative_prompt": "blur, distort, and low quality",
  "cfg_scale": 0.5
}
```

```
{
  "video": {
    "url": "https://v2.fal.media/files/36087878b0c1435bb75c19b64b7db178_output.mp4"
  }
}
```

