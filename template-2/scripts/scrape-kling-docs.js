const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Starting browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  console.log('Navigating to Replicate Kling API page...');
  await page.goto('https://replicate.com/kwaivgi/kling-v1.6-standard/api', {
    waitUntil: 'networkidle2',
  });
  
  // Wait for the page to load API details
  console.log('Waiting for API content to load...');
  await page.waitForSelector('pre', { timeout: 10000 });
  
  console.log('Extracting API documentation...');
  
  // Get the model description
  const modelDescription = await page.evaluate(() => {
    const descEl = document.querySelector('h1 + div');
    return descEl ? descEl.innerText : '';
  });
  
  // Get code examples and API details
  const codeExamples = await page.evaluate(() => {
    const preElements = Array.from(document.querySelectorAll('pre'));
    return preElements.map(pre => pre.innerText);
  });
  
  // Extract input parameters documentation (often in a table)
  const inputParams = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    const paramData = [];
    
    tables.forEach(table => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText);
      
      if (headers.includes('Parameter') || headers.includes('Name')) {
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        
        rows.forEach(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          
          if (cells.length >= 2) {
            paramData.push({
              name: cells[0].innerText.trim(),
              description: cells[1].innerText.trim(),
              default: cells[2]?.innerText.trim() || 'None',
              type: cells[3]?.innerText.trim() || 'Unknown'
            });
          }
        });
      }
    });
    
    return paramData;
  });
  
  // Take a screenshot for reference
  await page.screenshot({ path: 'kling-api-docs.png' });
  
  // Compile the documentation
  const documentation = {
    modelId: 'kwaivgi/kling-v1.6-standard',
    description: modelDescription,
    latestVersion: '7e324e5fcb9479696f15ab6da262390cddf5a1efa2e11374ef9d1f85fc0f82da',
    codeExamples,
    inputParameters: inputParams,
    notes: [
      'Based on the API documentation and error messages received',
      'The start_image must be at least 300x300 pixels',
      'The model requires a prompt describing the desired motion',
      'Duration can be 5 or 10 seconds',
      'cfg_scale controls the flexibility in video generation (0-1)',
      'aspect_ratio can be "16:9", "9:16", or "1:1"',
      'negative_prompt is optional'
    ]
  };
  
  // Get additonal information about parameters from page text
  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText) {
    documentation.rawTextInfo = pageText
      .split('\n')
      .filter(line => line.includes('prompt') || line.includes('image') || line.includes('scale') || 
              line.includes('duration') || line.includes('aspect'))
      .join('\n');
  }
  
  // Write to file
  const outputPath = path.join(__dirname, '../src/app/api/kling-model-reference.json');
  fs.writeFileSync(outputPath, JSON.stringify(documentation, null, 2));
  
  console.log(`API documentation saved to ${outputPath}`);
  await browser.close();
})(); 