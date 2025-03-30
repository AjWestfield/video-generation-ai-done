const puppeteer = require('puppeteer');
const fs = require('fs');

const url = 'https://replicate.com/black-forest-labs/flux-1.1-pro/api'; // Target the desired model
const outputFile = 'flux-1.1-pro-full-page-source.html'; // Output file for full HTML source

(async () => {
  let browser;
  console.log(`Attempting to scrape: ${url}`);
  try {
    browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); // Wait longer for network activity to cease

    console.log('Page loaded. Attempting to extract content...');

    // Get the full HTML content of the page
    const pageContent = await page.content();

    if (pageContent) {
      console.log(`Successfully retrieved full page HTML. Writing to ${outputFile}...`);
      fs.writeFileSync(outputFile, pageContent);
      console.log(`Full HTML source saved to ${outputFile}`);
    } else {
      console.error('Failed to retrieve page content.');
      // As a fallback, take a screenshot
      const screenshotPath = 'flux-1.1-pro-api-fallback-screenshot-full-html.png';
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`HTML retrieval failed. Saved a fallback screenshot to ${screenshotPath}`);
    }

  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
})();
