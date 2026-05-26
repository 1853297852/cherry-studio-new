#!/usr/bin/env node

/**
 * Publish app to GitHub Releases
 * 
 * Usage:
 *   node scripts/publish-release.js [version] [--pre]
 * 
 * Example:
 *   node scripts/publish-release.js 1.10.0
 *   node scripts/publish-release.js 1.10.0-beta.1 --pre
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const https = require('https')

const args = process.argv.slice(2)
const version = args[0]
const isPre = args.includes('--pre')

if (!version) {
  console.error('❌ Please provide a version number')
  console.error('Usage: node scripts/publish-release.js <version> [--pre]')
  process.exit(1)
}

const projectRoot = path.resolve(__dirname, '..')
const outDir = path.join(projectRoot, 'dist')

console.log('🚀 Starting release process...\n')

try {
  // Step 1: Verify version format
  console.log('📝 Verifying version format...')
  if (!version.match(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i)) {
    throw new Error(`Invalid version format: ${version}`)
  }
  console.log(`✅ Version valid: ${version}\n`)

  // Step 2: Update package.json version
  console.log('🔧 Updating package.json version...')
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  packageJson.version = version
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  console.log(`✅ Updated package.json to version ${version}\n`)

  // Step 3: Build for Windows x64
  console.log('🔨 Building Windows x64 installer...')
  execSync('pnpm run build:win:x64', {
    cwd: projectRoot,
    stdio: 'inherit'
  })
  console.log('✅ Windows x64 build complete\n')

  // Step 4: Prepare release assets
  console.log('📦 Preparing release assets...')
  const distFiles = fs.readdirSync(outDir)
  const exeFiles = distFiles.filter(f => 
    f.endsWith('.exe') && f.includes('setup')
  )
  const portableFiles = distFiles.filter(f => 
    f.endsWith('.exe') && f.includes('portable')
  )

  if (exeFiles.length === 0) {
    throw new Error('No setup exe files found in dist directory')
  }

  console.log(`Found ${exeFiles.length} installer(s):`)
  exeFiles.forEach(f => console.log(`  - ${f}`))
  console.log(`Found ${portableFiles.length} portable exe(s):`)
  portableFiles.forEach(f => console.log(`  - ${f}`))
  console.log()

  // Step 5: Create git tag
  console.log('🏷️  Creating git tag...')
  try {
    execSync(`git tag -d v${version}`, { stdio: 'ignore' })
  } catch {}
  execSync(`git tag v${version}`)
  console.log(`✅ Created tag v${version}\n`)

  // Step 6: Push to GitHub
  console.log('🚀 Pushing to GitHub...')
  execSync('git push origin main')
  execSync(`git push origin v${version}`)
  console.log('✅ Pushed to GitHub\n')

  // Step 7: Use electron-builder to publish
  console.log('📤 Publishing with electron-builder...')
  const publishCmd = `electron-builder --win --x64 --publish always`
  execSync(publishCmd, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      GH_TOKEN: process.env.GITHUB_TOKEN,
      DRAFT: false,
      PRERELEASE: isPre
    }
  })

  console.log('\n✅ Release published successfully!')
  console.log(`📄 Release page: https://github.com/1853297852/cherry-studio-new/releases/tag/v${version}`)

} catch (error) {
  console.error('\n❌ Release failed:', error.message)
  process.exit(1)
}
