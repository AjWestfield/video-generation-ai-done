const puppeteer = require('puppeteer');
const fs = require('fs').promises;

const url = 'https://fal.ai/models/fal-ai/kling-video/v1.6/pro/image-to-video/api';
const outputFile = 'fal-kling-api-reference.md';

async function scrapeDocs() {
  let browser = null;
  console.log(`Launching browser to scrape ${url}...`);
  try {
    browser = await puppeteer.launch({ 
      headless: true, // Run in headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Common args for server environments
    });
    const page = await browser.newPage();
    
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); // Wait longer for network to be idle

    console.log('Page loaded. Extracting documentation content...');

    // Extract content - targeting specific sections if possible, otherwise broader elements
    const extractedData = await page.evaluate(() => {
      let content = '';
      
      // Try specific selectors first (adjust based on actual page structure if known)
      const mainContent = document.querySelector('main article, main .content, #main-content, .api-docs-section');
      const codeBlocks = document.querySelectorAll('pre, code, .code-block');
      const paramTables = document.querySelectorAll('table, .parameter-list');

      if (mainContent) {
        content += `## Main Content\n\n${mainContent.innerText}\n\n`;
      } else {
         // Fallback to body if main content not found
         content += `## Full Page Text (Fallback)\n\n${document.body.innerText}\n\n`;
      }

      if (codeBlocks.length > 0) {
        content += `## Code Examples\n\n`;
        codeBlocks.forEach(block => {
          content += '```\n' + block.innerText + '\n```\n\n';
        });
      }
      
      if (paramTables.length > 0) {
         content += `## Parameters / Tables\n\n`;
         paramTables.forEach(table => {
            // Basic table to markdown attempt (may need refinement)
            const rows = Array.from(table.querySelectorAll('tr'));
            rows.forEach((row, rowIndex) => {
               const cells = Array.from(row.querySelectorAll('th, td'));
               content += `| ${cells.map(cell => cell.innerText.trim()).join(' | ')} |\n`;
               if (rowIndex === 0 && cells.length > 0 && cells[0].tagName === 'TH') {
                  content += `| ${cells.map(() => '---').join(' | ')} |\n`;
               }
            });
            content += '\n';
         });
      }

      return content;
    });

    console.log(`Extracted content length: ${extractedData.length}`);
    
    if (!extractedData || extractedData.trim().length < 100) {
       console.warn("Extracted content seems too short. Might indicate scraping issues.");
       // Attempt to get raw HTML as a last resort
       const rawHtml = await page.content();
       await fs.writeFile(outputFile.replace('.md', '.html'), rawHtml);
       console.log(`Saved raw HTML fallback to ${outputFile.replace('.md', '.html')}`);
       throw new Error("Failed to extract meaningful documentation text. Saved raw HTML instead.");
    }

    console.log(`Saving documentation to ${outputFile}...`);
    await fs.writeFile(outputFile, `# Fal AI Kling API Reference (${url})\n\n${extractedData}`);
    console.log(`Successfully saved documentation to ${outputFile}`);

  } catch (error) {
    console.error('Error during scraping:', error);
    // Ensure output file indicates failure if error occurs before writing
    try {
      await fs.writeFile(outputFile, `# Scraping Failed\n\nError scraping ${url}:\n\n${error.message}`);
    } catch (writeError) {
      console.error('Failed to write error to output file:', writeError);
    }
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
}

scrapeDocs();
