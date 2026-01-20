import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as io from '@actions/io';
import * as os from 'os';
import * as path from 'path';

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
async function verifyInstallation() {
  core.info('Verifying Copilot CLI installation...');
  
  try {
    // Try to find copilot in PATH
    const copilotPath = await io.which('copilot', false);
    
    if (!copilotPath) {
      throw new Error('Copilot CLI not found in PATH');
    }
    
    core.info(`Copilot CLI found at: ${copilotPath}`);
    
    // Get version
    let versionOutput = '';
    await exec.exec('copilot', ['--version'], {
      listeners: {
        stdout: (data) => {
          versionOutput += data.toString();
        }
      },
      silent: true
    });
    
    const version = versionOutput.trim();
    core.info(`Copilot CLI version: ${version}`);
    
    // Verify that Copilot CLI can be started by checking help command
    core.info('Testing if Copilot CLI can be started...');
    let helpOutput = '';
    await exec.exec('copilot', ['--help'], {
      listeners: {
        stdout: (data) => {
          helpOutput += data.toString();
        }
      },
      silent: true
    });
    
    // Check if help output contains expected content
    if (!helpOutput || helpOutput.length === 0) {
      throw new Error('Copilot CLI help command returned no output');
    }
    
    core.info('✓ Copilot CLI can be started successfully');
    
    return { success: true, version, path: copilotPath };
  } catch (error) {
    core.warning(`Verification failed: ${error.message}`);
    return { success: false, version: null, path: null };
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
    
    core.info(`Requested version: ${version}`);
    
    // Set GitHub token as environment variable if provided
    if (token) {
      core.exportVariable('GITHUB_TOKEN', token);
      core.info('GitHub token configured');
    }
    
    // Detect platform and architecture - this will throw if unsupported
    const platformInfo = getPlatformInfo();
    core.info(`Platform: ${platformInfo.platform}, Architecture: ${platformInfo.arch}`);
    
    // Try to install
    let installed = false;
    
    // Try npm first (works on all platforms)
    installed = await installVianpm(version);
    
    // If npm failed and we're on Linux/macOS, try the install script
    if (!installed && (platformInfo.platform === 'linux' || platformInfo.platform === 'macos')) {
      core.info('Attempting installation via install script...');
      installed = await installViaScript(version, platformInfo);
    }
    
    if (!installed) {
      throw new Error('Failed to install Copilot CLI using any available method');
    }
    
    // Verify installation and that CLI can be started
    const verification = await verifyInstallation();
    
    if (!verification.success) {
      throw new Error('Copilot CLI was installed but verification failed. The CLI cannot be started.');
    }
    
    // Set outputs
    core.setOutput('version', verification.version);
    core.setOutput('path', verification.path);
    
    core.info('✅ GitHub Copilot CLI setup completed successfully!');
    core.info(`Version: ${verification.version}`);
    core.info(`Path: ${verification.path}`);
    
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();
