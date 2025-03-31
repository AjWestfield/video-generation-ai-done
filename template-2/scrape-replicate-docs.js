const puppeteer = require('puppeteer');
const fs = require('fs');

const urls = [
  'https://replicate.com/kwaivgi/kling-v1.6-standard/api/api-reference',
  'https://replicate.com/kwaivgi/kling-v1.6-standard/api/schema',
  'https://replicate.com/kwaivgi/kling-v1.6-standard/api/learn-more',
  'https://replicate.com/kwaivgi/kling-v1.6-standard/api',
  'https://replicate.com/kwaivgi/kling-v1.6-standard/examples',
  'https://replicate.com/kwaivgi/kling-v1.6-standard/readme'
];
const outputFile = 'replicate-kling-reference.md'; // New output file

(async () => {
  let browser;
  let combinedMarkdown = `# Replicate Kling v1.6 Standard Documentation\n\n`;
  console.log(`Launching browser to scrape Replicate Kling docs...`);
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    for (const url of urls) {
      console.log(`\nAttempting to scrape: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`Page loaded: ${url}`);

      combinedMarkdown += `\n\n---\n\n## Source: ${url}\n\n`;

      // Use page.evaluate for targeted extraction
      const extractedData = await page.evaluate(() => {
        let markdown = '';
        
        // --- Extract Model Identifier (often near API endpoint examples) ---
        const codeElements = Array.from(document.querySelectorAll('code'));
        const modelIdElement = codeElements.find(el => el.innerText.includes('kwaivgi/kling-v1.6-standard'));
        if (modelIdElement) {
           markdown += `### Model Identifier Found\n\n\`\`\`\n${modelIdElement.innerText.trim()}\n\`\`\`\n\n`;
        }

        // --- Extract Schema / Parameters (look for specific sections/tables) ---
        const schemaSection = document.querySelector('section[aria-labelledby="inputs"], section[aria-labelledby="outputs"], div.schema');
        if (schemaSection) {
           markdown += `### Schema / Parameters\n\n`;
           // Extract relevant text or structure from the schema section
           // This might involve parsing tables, definition lists, or preformatted text
           const paramItems = schemaSection.querySelectorAll('dt, dd, li, table tr'); // Common elements
           if (paramItems.length > 0) {
              paramItems.forEach(item => {
                 if (item.tagName === 'DT') markdown += `*   **\`${item.innerText.trim()}\`**: `;
                 else if (item.tagName === 'DD') markdown += `${item.innerText.trim()}\n`;
                 else if (item.tagName === 'LI') markdown += `*   ${item.innerText.trim()}\n`;
                 else if (item.tagName === 'TR') { // Basic table row handling
                    const cells = Array.from(item.querySelectorAll('th, td'));
                    markdown += `| ${cells.map(cell => cell.innerText.trim().replace(/\n/g, ' ')).join(' | ')} |\n`;
                 }
              });
           } else {
              markdown += schemaSection.innerText.trim() + '\n'; // Fallback to innerText
           }
           markdown += '\n';
        }

        // --- Extract Code Examples ---
        const codeBlocks = document.querySelectorAll('pre, .code-block, div[class*="code"]');
        if (codeBlocks.length > 0) {
          markdown += `### Code Examples\n\n`;
          codeBlocks.forEach(block => {
            let lang = '';
            const langMatch = block.className.match(/language-(\w+)/);
            if (langMatch) lang = langMatch[1];
            // Find inner code element if present
            const codeContent = block.querySelector('code') || block;
            markdown += `\`\`\`${lang}\n${codeContent.innerText.trim()}\n\`\`\`\n\n`;
          });
        }
        
        // --- Extract General Content (Readme, Learn More) ---
        // Use a more general selector for text content if specific sections aren't found
        if (!schemaSection && codeBlocks.length === 0) {
           const mainContent = document.querySelector('main, article, .prose');
           if (mainContent) {
              markdown += `### General Content\n\n${mainContent.innerText.trim()}\n\n`;
           } else {
              // Last resort: grab significant text chunks from body
              const bodyText = document.body.innerText.replace(/\s+/g, ' ').trim();
              markdown += `### General Content (Body Fallback)\n\n${bodyText.substring(0, 5000)}...\n\n`; // Limit length
           }
        }

        return markdown;
      });

      if (extractedData && extractedData.trim().length > 10) { // Check if we got *any* content
        console.log(`Successfully extracted content from ${url}. Length: ${extractedData.length}`);
        combinedMarkdown += extractedData;
      } else {
        console.warn(`Failed to extract significant content from ${url}.`);
        combinedMarkdown += `*Failed to extract significant content from this URL.*\n`;
      }
      // Use standard setTimeout for delay
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between pages
    } // End URL loop

    console.log(`\nWriting combined documentation to ${outputFile}...`);
    fs.writeFileSync(outputFile, combinedMarkdown);
    console.log(`Combined documentation saved to ${outputFile}`);

  } catch (error) {
    console.error('Error during scraping:', error);
     try {
       fs.writeFileSync(outputFile, `# Scraping Failed\n\nError during scraping process:\n\n${error.message}\n\nPartial Content:\n${combinedMarkdown}`);
     } catch (writeError) {
       console.error('Failed to write error to output file:', writeError);
     }
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
})();
