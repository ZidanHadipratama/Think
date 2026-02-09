const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apiDir = path.join(process.cwd(), 'app', 'api');
const tempApiDir = path.join(process.cwd(), 'app', '_api_hidden');
const chatPagePath = path.join(process.cwd(), 'app', 'chat', '[[...id]]', 'page.tsx');

function moveDir(src, dest) {
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest);
    console.log(`Moved ${src} to ${dest}`);
    return true;
  }
  return false;
}

function toggleDynamicParams(filePath, toValue) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Regex to find "export const dynamicParams = true;" or false
    const regex = /export const dynamicParams = (true|false);/;
    if (regex.test(content)) {
      const newContent = content.replace(regex, `export const dynamicParams = ${toValue};`);
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Set dynamicParams = ${toValue} in ${filePath}`);
      return true;
    }
  }
  console.warn(`Could not toggle dynamicParams in ${filePath}`);
  return false;
}

let moved = false;
let toggledPage = false;

try {
  // 1. Hide API routes to prevent static export errors
  moved = moveDir(apiDir, tempApiDir);

  // 2. Set dynamicParams = false for Static Export compatibility
  toggledPage = toggleDynamicParams(chatPagePath, false);

  // 3. Run Next.js Build
  console.log('Running mobile build...');
  execSync('MOBILE_BUILD=true next build', { stdio: 'inherit' });

} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
} finally {
  // 4. Restore API routes
  if (moved) {
    moveDir(tempApiDir, apiDir);
  }
  // 5. Restore dynamicParams = true for Dev
  if (toggledPage) {
    toggleDynamicParams(chatPagePath, true);
  }
}
