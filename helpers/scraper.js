const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
  });
  const page = await browser.newPage();

  await page.goto("https://httpbin.io/user-agent");

  const content = await page.evaluate(() => document.body.textContent);

  console.log("Content: ", content);

  await browser.close();
})();
