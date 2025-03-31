# Replicate Kling v1.6 Standard Documentation



---

## Source: https://replicate.com/kwaivgi/kling-v1.6-standard/api/api-reference

### Model Identifier Found

```
import Replicate from "replicate";
const replicate = new Replicate();

const input = {
    prompt: "a portrait photo of a woman underwater with flowing hair",
    start_image: "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg"
};

const output = await replicate.run("kwaivgi/kling-v1.6-standard", { input });

import { writeFile } from "node:fs/promises";
await writeFile("output.mp4", output);
//=> output.mp4 written to disk
```

### Code Examples

```
{
  "version": "5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa",
  "input": {
    "text": "Alice"
  },
  "webhook": "https://example.com/my-webhook",
  "webhook_events_filter": ["start", "completed"]
}
```

```
import Replicate from "replicate";
const replicate = new Replicate();

const input = {
    prompt: "a portrait photo of a woman underwater with flowing hair",
    start_image: "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg"
};

const output = await replicate.run("kwaivgi/kling-v1.6-standard", { input });

import { writeFile } from "node:fs/promises";
await writeFile("output.mp4", output);
//=> output.mp4 written to disk
```

```
import Replicate from "replicate";
const replicate = new Replicate();

console.log("Getting prediction...")
const prediction = await replicate.predictions.get(predictionId);
//=> {"id": "xyz...", "status": "successful", ... }
```

```
import Replicate from "replicate";
const replicate = new Replicate();

console.log("Canceling prediction...")
const prediction = await replicate.predictions.cancel(predictionId);
//=> {"id": "xyz...", "status": "canceled", ... }
```

```
import Replicate from "replicate";
const replicate = new Replicate();

const page = await replicate.predictions.list();
console.log(page.results)
//=> [{ "id": "xyz...", "status": "successful", ... }, { ... }]
```



---

## Source: https://replicate.com/kwaivgi/kling-v1.6-standard/api/schema

### General Content

OFFICIAL
kwaivgi / kling-v1.6-standard 

Generate 5s and 10s videos in 720p resolution

Warm
Public
155.3K runs
$0.056 per second of video
Commercial use
Run with an API
Playground
API
Examples
README

Run replicate/kling-v1.6-standard-internal with an API

TABLE OF CONTENTS

Node.js
Python
HTTP
Get started
Learn more
Schema
API reference
Input schema
Table
JSON
prompt
string

Text prompt for video generation

duration
integer

Duration of the video in seconds

Default
5
cfg_scale
number

Flexibility in video generation; The higher the value, the lower the model's degree of flexibility, and the stronger the relevance to the user's prompt.

Default
0.5
Maximum
1
start_image
uri

First frame of the video

aspect_ratio
string

Aspect ratio of the video. Ignored if start_image is provided.

Default
"16:9"
negative_prompt
string

Things you do not want to see in the video

Output schema
Table
JSON
Type
uri



---

## Source: https://replicate.com/kwaivgi/kling-v1.6-standard/api/learn-more

### Model Identifier Found

```
const input = {
    prompt: "a portrait photo of a woman underwater with flowing hair",
    start_image: "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg"
};

const output = await replicate.run("kwaivgi/kling-v1.6-standard", { input });

import { writeFile } from "node:fs/promises";
await writeFile("output.mp4", output);
//=> output.mp4 written to disk
```

### Code Examples

```
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
curl https://api.replicate.com/v1/account -H "Authorization: Bearer $REPLICATE_API_TOKEN"
# {"type":"user","username":"aron","name":"Aron Carroll","github_url":"https://github.com/aron"}
```

```
echo "$REPLICATE_API_TOKEN"
# "r8_xyz"
```

```
npm create esm -y
```

```
npm install replicate
```

```
import Replicate from "replicate";

const replicate = new Replicate();
```

```
npm create -y
```

```
npm install replicate
```

```
const Replicate = require("replicate");

const replicate = new Replicate();
```

```
const input = {
    prompt: "a portrait photo of a woman underwater with flowing hair",
    start_image: "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg"
};

const output = await replicate.run("kwaivgi/kling-v1.6-standard", { input });

import { writeFile } from "node:fs/promises";
await writeFile("output.mp4", output);
//=> output.mp4 written to disk
```

```
const start_image = "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg";
```

```
import { readFile } from "node:fs/promises";
const start_image = await readFile("./path/to/my/start_image.jpeg");
```

```
import { readFile } from "node:fs/promises";
const data = (await readFile("./start_image.jpeg")).toString("base64");
const start_image = `data:application/octet-stream;base64,${data}`;
```

```
const input = {
    prompt: "a portrait photo of a woman underwater with flowing hair",
    start_image: start_image
};

const output = await replicate.run("kwaivgi/kling-v1.6-standard", { input });

import { writeFile } from "node:fs/promises";
await writeFile("output.mp4", output);
//=> output.mp4 written to disk
```

```

```

```

```

```
const input = {
    prompt: "a portrait photo of a woman underwater with flowing hair",
    start_image: "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg"
};

const callbackURL = `https://my.app/webhooks/replicate`;
await replicate.predictions.create({
  model: "kwaivgi/kling-v1.6-standard",
  input: input,
  webhook: callbackURL,
  webhook_events_filter: ["completed"],
});

// The server will now handle the event and log:
// => {"id": "xyz", "status": "successful", ... }
```

```

```

```
const input = {
    prompt: "a portrait photo of a woman underwater with flowing hair",
    start_image: "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg"
};
const prediction = replicate.predictions.create({
  model: "kwaivgi/kling-v1.6-standard",
  input
});
// { "id": "xyz123", "status": "starting", ... }
```

```
await replicate.predictions.cancel(prediction.id);
```



---

## Source: https://replicate.com/kwaivgi/kling-v1.6-standard/api

### Model Identifier Found

```
import Replicate from "replicate";
const replicate = new Replicate();

const input = {
    prompt: "a portrait photo of a woman underwater with flowing hair",
    start_image: "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg"
};

const output = await replicate.run("kwaivgi/kling-v1.6-standard", { input });

import { writeFile } from "node:fs/promises";
await writeFile("output.mp4", output);
//=> output.mp4 written to disk
```

### Code Examples

```
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
npm install replicate
```

```
import Replicate from "replicate";
const replicate = new Replicate();

const input = {
    prompt: "a portrait photo of a woman underwater with flowing hair",
    start_image: "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg"
};

const output = await replicate.run("kwaivgi/kling-v1.6-standard", { input });

import { writeFile } from "node:fs/promises";
await writeFile("output.mp4", output);
//=> output.mp4 written to disk
```



---

## Source: https://replicate.com/kwaivgi/kling-v1.6-standard/examples

### Model Identifier Found

```
const input = {
  prompt: "Teenager skateboarding through city rain, motion blur, cinematic shot, hyperrealistic photo, 8K, Canon EOS R5",
  duration: 5,
  cfg_scale: 0.5,
  aspect_ratio: "1:1",
  negative_prompt: ""
};

const output = await replicate.run("kwaivgi/kling-v1.6-standard", { input });
console.log(output);
```

### Code Examples

```
{
  "prompt": "Teenager skateboarding through city rain, motion blur, cinematic shot, hyperrealistic photo, 8K, Canon EOS R5",
  "duration": 5,
  "cfg_scale": 0.5,
  "aspect_ratio": "1:1",
  "negative_prompt": ""
}
```

```
npm install replicate
```

```
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});
```

```
const input = {
  prompt: "Teenager skateboarding through city rain, motion blur, cinematic shot, hyperrealistic photo, 8K, Canon EOS R5",
  duration: 5,
  cfg_scale: 0.5,
  aspect_ratio: "1:1",
  negative_prompt: ""
};

const output = await replicate.run("kwaivgi/kling-v1.6-standard", { input });
console.log(output);
```

```
pip install replicate
```

```
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
import replicate
```

```
output = replicate.run(
    "kwaivgi/kling-v1.6-standard",
    input={
        "prompt": "Teenager skateboarding through city rain, motion blur, cinematic shot, hyperrealistic photo, 8K, Canon EOS R5",
        "duration": 5,
        "cfg_scale": 0.5,
        "aspect_ratio": "1:1",
        "negative_prompt": ""
    }
)
print(output)
```

```
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
curl -s -X POST \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: wait" \
  -d $'{
    "input": {
      "prompt": "Teenager skateboarding through city rain, motion blur, cinematic shot, hyperrealistic photo, 8K, Canon EOS R5",
      "duration": 5,
      "cfg_scale": 0.5,
      "aspect_ratio": "1:1",
      "negative_prompt": ""
    }
  }' \
  https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions
```

```
{
  "completed_at": "2025-01-24T12:05:07.558470Z",
  "created_at": "2025-01-24T11:59:29.513000Z",
  "data_removed": false,
  "error": null,
  "id": "khbd1gvpx5rg80cmk0qay68a40",
  "input": {
    "prompt": "Teenager skateboarding through city rain, motion blur, cinematic shot, hyperrealistic photo, 8K, Canon EOS R5",
    "duration": 5,
    "cfg_scale": 0.5,
    "aspect_ratio": "1:1",
    "negative_prompt": ""
  },
  "logs": "Moderating content...\n\nModeration complete in 0.27sec\n\nRunning prediction... \n\nGenerating video...\n\nGenerated video in 321.0sec\n\nDownloading 8922171 bytes\n\nDownloaded 8.51MB in 16.69sec",
  "metrics": {
    "predict_time": 338.023213616,
    "total_time": 338.04547
  },
  "output": "https://replicate.delivery/czjl/ffbFf9RcKEEzLpUq8poXHIz0OjQAHcX8pfOiw1edPdif8zECF/tmp7jlqfl71.mp4",
  "started_at": "2025-01-24T11:59:29.535256Z",
  "status": "succeeded",
  "urls": {
    "stream": "https://stream.replicate.com/v1/files/fddq-t4g5lf6g55qrsag7oxypsmmnhnvua2gpaq6h7yo4sciua3oqexeq",
    "get": "https://api.replicate.com/v1/predictions/khbd1gvpx5rg80cmk0qay68a40",
    "cancel": "https://api.replicate.com/v1/predictions/khbd1gvpx5rg80cmk0qay68a40/cancel"
  },
  "version": "hidden"
}
```

```
{
  "prompt": "Teenager skateboarding through city rain, motion blur, cinematic shot, hyperrealistic photo, 8K, Canon EOS R5",
  "duration": 5,
  "cfg_scale": 0.5,
  "aspect_ratio": "1:1",
  "negative_prompt": ""
}
```

```
npm install replicate
```

```
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});
```

```
const input = {
  prompt: "Teenager skateboarding through city rain, motion blur, cinematic shot, hyperrealistic photo, 8K, Canon EOS R5",
  duration: 5,
  cfg_scale: 0.5,
  aspect_ratio: "1:1",
  negative_prompt: ""
};

const output = await replicate.run("kwaivgi/kling-v1.6-standard", { input });
console.log(output);
```

```
pip install replicate
```

```
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
import replicate
```

```
output = replicate.run(
    "kwaivgi/kling-v1.6-standard",
    input={
        "prompt": "Teenager skateboarding through city rain, motion blur, cinematic shot, hyperrealistic photo, 8K, Canon EOS R5",
        "duration": 5,
        "cfg_scale": 0.5,
        "aspect_ratio": "1:1",
        "negative_prompt": ""
    }
)
print(output)
```

```
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
curl -s -X POST \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: wait" \
  -d $'{
    "input": {
      "prompt": "Teenager skateboarding through city rain, motion blur, cinematic shot, hyperrealistic photo, 8K, Canon EOS R5",
      "duration": 5,
      "cfg_scale": 0.5,
      "aspect_ratio": "1:1",
      "negative_prompt": ""
    }
  }' \
  https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions
```

```
{
  "completed_at": "2025-01-24T11:47:00.869717Z",
  "created_at": "2025-01-24T11:40:38.924000Z",
  "data_removed": false,
  "error": null,
  "id": "ytv3219phhrgc0cmk0ev1kq9f0",
  "input": {
    "prompt": "Teenager skateboarding through city rain, motion blur, cinematic shot, hyperrealistic photo, 8K, Canon EOS R5",
    "duration": 5,
    "cfg_scale": 0.5,
    "aspect_ratio": "1:1",
    "negative_prompt": ""
  },
  "logs": "Moderating content...\n\nModeration complete in 0.25sec\n\nRunning prediction... \n\nGenerating video...\n\nGenerated video in 368.7sec\n\nDownloading 9974075 bytes\n\nDownloaded 9.51MB in 12.92sec",
  "metrics": {
    "predict_time": 381.928561825,
    "total_time": 381.945717
  },
  "output": "https://replicate.delivery/czjl/yha2A4K6PoZvF1YVmbmZvBPefnhiQVceFBJJRUlDk2Uo9lQoA/tmp_03qe2z0.mp4",
  "started_at": "2025-01-24T11:40:38.941155Z",
  "status": "succeeded",
  "urls": {
    "stream": "https://stream.replicate.com/v1/files/fddq-c7r3xlmyz6j253nocd3viixteliwzsqlzutj6hbprqwjjghbgluq",
    "get": "https://api.replicate.com/v1/predictions/ytv3219phhrgc0cmk0ev1kq9f0",
    "cancel": "https://api.replicate.com/v1/predictions/ytv3219phhrgc0cmk0ev1kq9f0/cancel"
  },
  "version": "hidden"
}
```

```
{
  "prompt": "a portrait photo of a woman underwater with flowing hair",
  "duration": 5,
  "cfg_scale": 0.5,
  "start_image": "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg",
  "aspect_ratio": "16:9",
  "negative_prompt": ""
}
```

```
npm install replicate
```

```
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});
```

```
const input = {
  prompt: "a portrait photo of a woman underwater with flowing hair",
  duration: 5,
  cfg_scale: 0.5,
  start_image: "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg",
  aspect_ratio: "16:9",
  negative_prompt: ""
};

const output = await replicate.run("kwaivgi/kling-v1.6-standard", { input });
console.log(output);
```

```
pip install replicate
```

```
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
import replicate
```

```
output = replicate.run(
    "kwaivgi/kling-v1.6-standard",
    input={
        "prompt": "a portrait photo of a woman underwater with flowing hair",
        "duration": 5,
        "cfg_scale": 0.5,
        "start_image": "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg",
        "aspect_ratio": "16:9",
        "negative_prompt": ""
    }
)
print(output)
```

```
export REPLICATE_API_TOKEN=<paste-your-token-here>
```

```
curl -s -X POST \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: wait" \
  -d $'{
    "input": {
      "prompt": "a portrait photo of a woman underwater with flowing hair",
      "duration": 5,
      "cfg_scale": 0.5,
      "start_image": "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg",
      "aspect_ratio": "16:9",
      "negative_prompt": ""
    }
  }' \
  https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions
```

```
{
  "completed_at": "2025-01-27T14:22:15.394999Z",
  "created_at": "2025-01-27T14:18:35.564000Z",
  "data_removed": false,
  "error": null,
  "id": "pmgav974nhrg80cmn0g96jc900",
  "input": {
    "prompt": "a portrait photo of a woman underwater with flowing hair",
    "duration": 5,
    "cfg_scale": 0.5,
    "start_image": "https://replicate.delivery/pbxt/MNRKHnYUu5HjNqEerj2kxWRmUD3xWGaZ0gJmhqVbkra2jCbD/underwater.jpeg",
    "aspect_ratio": "16:9",
    "negative_prompt": ""
  },
  "logs": "Moderating content...\n\nModerating content...\n\nModeration complete in 0.25sec\n\nModeration complete in 1.82sec\n\nRunning prediction...\nUsing model: kling-v1-6 in std mode\nGenerating video...\nGenerated video in 181.6sec\nDownloading 2847266 bytes\nDownloaded 2.72MB in 2.53sec",
  "metrics": {
    "predict_time": 186.347748033,
    "total_time": 219.830999
  },
  "output": "https://replicate.delivery/czjl/xFIwsxPXTtpCHJw2WqLH3gqACg3csLVVdKtbLf1heBzXiUJUA/tmp35xuh600.mp4",
  "started_at": "2025-01-27T14:19:09.047251Z",
  "status": "succeeded",
  "urls": {
    "stream": "https://stream.replicate.com/v1/files/fddq-r2znzsgjy5cszuvd4waxqrnifqxhaie6swn7npuupmwqzju2xr2a",
    "get": "https://api.replicate.com/v1/predictions/pmgav974nhrg80cmn0g96jc900",
    "cancel": "https://api.replicate.com/v1/predictions/pmgav974nhrg80cmn0g96jc900/cancel"
  },
  "version": "hidden"
}
```



---

## Source: https://replicate.com/kwaivgi/kling-v1.6-standard/readme

### General Content

OFFICIAL
kwaivgi / kling-v1.6-standard 

Generate 5s and 10s videos in 720p resolution

Warm
Public
155.3K runs
$0.056 per second of video
Commercial use
Run with an API
Playground
API
Examples
README
Kling v1.6

An AI text-to-video generation model developed by Kuaishou AI Team.

Data from this model is sent from Replicate to Kuaishou.

https://klingai.com/

Privacy policy

https://docs.qingque.cn/d/home/eZQCzFHiWVM1OFfpXZb3kGthx

API terms

https://docs.qingque.cn/d/home/eZQC4FkUthNLuEMk9AgXvH-et

Service level agreement

https://docs.qingque.cn/d/home/eZQAedFwivWXjj_2d_ITWyV2X

