// Screenshot di anteprima con Edge (playwright-core senza download di browser).
// Uso: node preview.mjs [url]
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

try {
  // Desktop
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "preview-desktop.png", fullPage: true });

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "preview-mobile.png", fullPage: true });
  console.log("OK: preview-desktop.png, preview-mobile.png");
} finally {
  await browser.close();
}
