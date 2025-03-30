# Replicate API Reference: black-forest-labs/flux-1.1-pro

Source URL: https://replicate.com/black-forest-labs/flux-1.1-pro/api

---

Faster, better FLUX Pro. Text-to-image model with excellent image quality, prompt adherence, and output diversity.

---

## Code Example 1:

```unknown
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

---

## Code Example 2:

```unknown
npm install replicate
```

---

## Code Example 3:

```unknown
import Replicate from "replicate";
const replicate = new Replicate();

const input = {
    prompt: "black forest gateau cake spelling out the words \"FLUX 1 . 1 Pro\", tasty, food photography",
    prompt_upsampling: true
};

const output = await replicate.run("black-forest-labs/flux-1.1-pro", { input });

import { writeFile } from "node:fs/promises";
await writeFile("output.jpg", output);
//=> output.jpg written to disk
```