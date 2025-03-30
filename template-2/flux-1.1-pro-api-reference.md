# Replicate API Reference: black-forest-labs/flux-1.1-pro

Source URL: https://replicate.com/black-forest-labs/flux-1.1-pro/api

---

Menu
OFFICIAL
black-forest-labs / flux-1.1-pro 

Faster, better FLUX Pro. Text-to-image model with excellent image quality, prompt adherence, and output diversity.

Warm
Public
23.3M runs
$0.04 per image
Commercial use
License
Run with an API
Playground
API
Examples
README

Run replicate/flux-1.1-pro-internal-model with an API

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

Run black-forest-labs/flux-1.1-pro using Replicate’s API. Check out the model's schema for an overview of inputs and outputs.

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