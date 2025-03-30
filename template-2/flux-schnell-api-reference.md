# Replicate API Reference: black-forest-labs/flux-schnell

Source URL: https://replicate.com/black-forest-labs/flux-schnell/api

---

Menu
OFFICIAL
black-forest-labs / flux-schnell 

The fastest image generation model tailored for local development and personal use

Warm
Public
268M runs
$0.003 per image
Commercial use
GitHub
Weights
License
Run with an API

Blog post:
Learn about training with Flux
Read the blog

Playground
API
Examples
README

Run replicate/flux-schnell-internal-model with an API

TABLE OF CONTENTS

Node.js
Python
HTTP
Get started
Learn more
Schema
API reference

Use one of our client libraries to get started quickly.

Node.js
Python
HTTP

Set the REPLICATE_API_TOKEN environment variable

export REPLICATE_API_TOKEN=<paste-your-token-here>
Visibility
Copy

Learn more about authentication

Install Replicate’s Node.js client library

npm install replicate
Copy
Learn more about setup

Run black-forest-labs/flux-schnell using Replicate’s API. Check out the model's schema for an overview of inputs and outputs.

import Replicate from "replicate";
const replicate = new Replicate();

const input = {
    prompt: "black forest gateau cake spelling out the words \"FLUX SCHNELL\", tasty, food photography, dynamic shot"
};

const output = await replicate.run("black-forest-labs/flux-schnell", { input });

import { writeFile } from "node:fs/promises";
for (const [index, item] of Object.entries(output)) {
  await writeFile(`output_${index}.webp`, item);
}
//=> output_0.webp written to disk
Copy
Learn more
Replicate
Home
About
Join us
Terms
Privacy
Status
Support