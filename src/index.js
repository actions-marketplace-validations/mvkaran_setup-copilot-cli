import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as io from '@actions/io';
import * as os from 'os';
import * as path from 'path';
import { ensureNodeAndNpm } from './nodeUtils.js';

/**
 * Validates the version input
 */
function validateVersion(version) {
  // Allow 'latest' and 'prerelease'
  if (version === 'latest' || version === 'prerelease') {
    return true;
  }
  
  // Validate version format (e.g., v0.0.369, 0.0.369)
  // Must be alphanumeric with dots, hyphens, and optionally start with 'v'
  const versionPattern = /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
  
  if (!versionPattern.test(version)) {
    throw new Error(`Invalid version format: ${version}. Expected format: 'latest', 'prerelease', or semantic version (e.g., 'v0.0.369' or '1.2.3')`);
  }
  
  return true;
}

/**
 * Detects the current platform and architecture
 */
function getPlatformInfo() {
  const platform = os.platform();
  const arch = os.arch();
  
  core.info(`Detected platform: ${platform}`);
  core.info(`Detected architecture: ${arch}`);
  
  let platformName;
  if (platform === 'win32') {
    platformName = 'windows';
  } else if (platform === 'darwin') {
    platformName = 'macos';
  } else if (platform === 'linux') {
    platformName = 'linux';
  } else {
    throw new Error(`Unsupported platform: ${platform}. Copilot CLI supports Linux, macOS, and Windows.`);
  }
  
  // Check architecture support
  // Copilot CLI supports x64 and arm64
  if (arch !== 'x64' && arch !== 'arm64') {
    throw new Error(`Unsupported architecture: ${arch}. Copilot CLI supports x64 and arm64 architectures.`);
  }
  
  return { platform: platformName, arch };
}


/**
 * Installs Copilot CLI using npm
 */
async function installVianpm(version) {
  core.info('Installing Copilot CLI via npm...');
  
  let packageName = '@github/copilot';
  
  if (version === 'prerelease') {
    packageName += '@prerelease';
  } else if (version !== 'latest') {
    packageName += `@${version}`;
  }
  
  core.info(`Installing package: ${packageName}`);
  
  try {
    await exec.exec('npm', ['install', '-g', packageName]);
    core.info('Copilot CLI installed successfully via npm');
    return true;
  } catch (error) {
    core.warning(`Failed to install via npm: ${error.message}`);
    return false;
  }
}

/**
 * Installs Copilot CLI using the install script (Linux/macOS only)
 */
async function installViaScript(version, platformInfo) {
  core.info('Installing Copilot CLI via install script...');
  
  if (platformInfo.platform === 'windows') {
    core.warning('Install script not supported on Windows');
    return false;
  }
  
  try {
    // Download the install script
    const scriptUrl = 'https://gh.io/copilot-install';
    const scriptPath = path.join(os.tmpdir(), 'copilot-install.sh');
    
    core.info(`Downloading install script from ${scriptUrl}`);
    const downloadedPath = await tc.downloadTool(scriptUrl, scriptPath);
    
    // Make the script executable
    await exec.exec('chmod', ['+x', downloadedPath]);
    
    // Prepare environment variables
    const env = { ...process.env };
    
    if (version !== 'latest' && version !== 'prerelease') {
      env.VERSION = version;
      core.info(`Setting VERSION=${version}`);
    }
    
    // Set PREFIX to install in a location accessible to the workflow
    const installDir = path.join(os.homedir(), '.local');
    env.PREFIX = installDir;
    core.info(`Setting PREFIX=${installDir}`);
    
    // Execute the install script
    await exec.exec('bash', [downloadedPath], { env });
    
    // Add to PATH
    const binPath = path.join(installDir, 'bin');
    core.addPath(binPath);
    core.info(`Added ${binPath} to PATH`);
    
    core.info('Copilot CLI installed successfully via install script');
    return true;
  } catch (error) {
    core.warning(`Failed to install via script: ${error.message}`);
    return false;
  }
}

/**
 * Verifies the installation and tests if Copilot CLI can be started
 */
async function getCopilotVersion() {
  let versionOutput = '';
  await exec.exec('copilot', ['-v'], {
    listeners: {
      stdout: (data) => {
        versionOutput += data.toString();
      }
    },
    silent: true
  });

  return versionOutput.trim();
}

function normalizeVersion(version) {
  if (!version) return '';
  return version.trim().replace(/^v/, '');
}

/**
 * Verifies the installation by checking version
 */
async function verifyInstallation(requestedVersion) {
  core.info('Verifying Copilot CLI installation...');

  try {
    const copilotPath = await io.which('copilot', false);

    if (!copilotPath) {
      throw new Error('Copilot CLI not found in PATH');
    }

    core.info(`Copilot CLI found at: ${copilotPath}`);

    const installedVersion = await getCopilotVersion();
    core.info(`Copilot CLI version: ${installedVersion}`);

    // Check version match if specific version was requested
    if (requestedVersion !== 'latest' && requestedVersion !== 'prerelease') {
      const desired = normalizeVersion(requestedVersion);
      const installed = normalizeVersion(installedVersion);

      if (!installed.includes(desired)) {
        throw new Error(`Installed Copilot CLI version (${installedVersion}) does not match requested version (${requestedVersion}).`);
      }
    }

    return { success: true, version: installedVersion, path: copilotPath };
  } catch (error) {
    throw new Error(`Verification failed: ${error.message}`);
  }
}

/**
 * Main action entrypoint
 */
async function run() {
  try {
    core.info('Setting up GitHub Copilot CLI...');
    
    // Get inputs
    const version = core.getInput('version') || 'latest';
    const token = core.getInput('token');
    
    // Validate version input
    validateVersion(version);
    
    core.info(`Requested version: ${version}`);
    
    // Set GH_TOKEN environment variable if token is provided
    // Note: We don't verify authentication - let Copilot CLI handle it
    if (token) {
      core.exportVariable('GH_TOKEN', token);
      core.info('✓ GH_TOKEN environment variable set from input token');
      core.info('  Copilot CLI will use this token for authentication');
    } else {
      core.info('ℹ️  No token input provided');
      core.info('  Copilot CLI will look for GH_TOKEN or GITHUB_TOKEN in the environment');
      core.info('  Make sure to set these via the "env:" section in your workflow');
    }
    
    // Detect platform and architecture - this will throw if unsupported
    const platformInfo = getPlatformInfo();
    core.info(`Platform: ${platformInfo.platform}, Architecture: ${platformInfo.arch}`);
    
    // Try to install
    let installed = false;
    
    // Try npm first (works on all platforms)
    await ensureNodeAndNpm(platformInfo);
    installed = await installVianpm(version);
    
    // If npm failed and we're on Linux/macOS, try the install script
    if (!installed && (platformInfo.platform === 'linux' || platformInfo.platform === 'macos')) {
      core.info('Attempting installation via install script...');
      installed = await installViaScript(version, platformInfo);
    }
    
    if (!installed) {
      throw new Error('Failed to install Copilot CLI using any available method');
    }
    
    // Verify installation (version check only)
    const verification = await verifyInstallation(version);
    
    // Set outputs
    core.setOutput('version', verification.version);
    core.setOutput('path', verification.path);
    
    core.info('✅ GitHub Copilot CLI setup completed successfully!');
    core.info(`   Version: ${verification.version}`);
    core.info(`   Path: ${verification.path}`);
    
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();
