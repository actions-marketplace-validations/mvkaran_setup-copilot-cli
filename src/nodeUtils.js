import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Ensures Node.js and npm are installed and meet minimum versions
 */
export async function ensureNodeAndNpm(platformInfo, minNodeMajor = 24, minNpmMajor = 10) {
  const getVersion = async (command, args) => {
    let output = '';
    await exec.exec(command, args, {
      listeners: {
        stdout: (data) => {
          output += data.toString();
        }
      },
      silent: true
    });
    return output.trim();
  };

  const parseMajor = (version) => {
    const match = version.match(/v?(\d+)/);
    return match ? Number(match[1]) : NaN;
  };

  const resolveNodeFilename = (shasums, platform, arch) => {
    const suffix = (() => {
      if (platform === 'windows') {
        return arch === 'arm64' ? 'win-arm64.zip' : 'win-x64.zip';
      }
      if (platform === 'macos') {
        return arch === 'arm64' ? 'darwin-arm64.tar.gz' : 'darwin-x64.tar.gz';
      }
      return arch === 'arm64' ? 'linux-arm64.tar.gz' : 'linux-x64.tar.gz';
    })();

    const line = shasums
      .split(/\r?\n/)
      .find((entry) => entry.includes(`-${suffix}`) && entry.includes('node-v'));

    if (!line) {
      throw new Error(`Unable to resolve Node.js binary for ${platform} ${arch}.`);
    }

    return line.trim().split(/\s+/).pop();
  };

  const installNodeAndNpm = async () => {
    const baseUrl = `https://nodejs.org/dist/latest-v${minNodeMajor}.x/`;
    core.info(`Downloading Node.js from ${baseUrl}`);

    const shasumsPath = await tc.downloadTool(`${baseUrl}SHASUMS256.txt`);
    const shasums = fs.readFileSync(shasumsPath, 'utf8');

    const filename = resolveNodeFilename(shasums, platformInfo.platform, platformInfo.arch);
    const downloadUrl = `${baseUrl}${filename}`;

    core.info(`Resolved Node.js package: ${filename}`);
    const archivePath = await tc.downloadTool(downloadUrl);

    let extractedPath;
    if (filename.endsWith('.zip')) {
      extractedPath = await tc.extractZip(archivePath);
    } else {
      extractedPath = await tc.extractTar(archivePath);
    }

    const entries = fs.readdirSync(extractedPath);
    const rootEntry = entries.length === 1 ? entries[0] : null;
    const rootPath = rootEntry ? path.join(extractedPath, rootEntry) : extractedPath;
    const binPath = platformInfo.platform === 'windows'
      ? rootPath
      : path.join(rootPath, 'bin');

    core.addPath(binPath);
    core.info(`Added Node.js to PATH: ${binPath}`);
  };

  const checkVersions = async () => {
    const nodePath = await io.which('node', false);
    const npmPath = await io.which('npm', false);

    if (!nodePath || !npmPath) {
      return { ok: false, nodeVersion: null, npmVersion: null };
    }

    const nodeVersion = await getVersion('node', ['--version']);
    const npmVersion = await getVersion('npm', ['--version']);

    const nodeMajor = parseMajor(nodeVersion);
    const npmMajor = parseMajor(npmVersion);

    const ok = Number.isFinite(nodeMajor)
      && Number.isFinite(npmMajor)
      && nodeMajor >= minNodeMajor
      && npmMajor >= minNpmMajor;

    return { ok, nodeVersion, npmVersion, nodeMajor, npmMajor };
  };

  let check = await checkVersions();

  if (!check.ok) {
    const detectedNode = check.nodeVersion ?? 'unknown';
    const detectedNpm = check.npmVersion ?? 'unknown';
    core.info(`Detected Node.js: ${detectedNode}; required: ${minNodeMajor}+`);
    core.info(`Detected npm: ${detectedNpm}; required: ${minNpmMajor}+`);
    core.info('Installing required Node.js/npm versions...');
    await installNodeAndNpm();
    check = await checkVersions();
  }

  if (!check.ok) {
    const detectedNode = check.nodeVersion ?? 'unknown';
    const detectedNpm = check.npmVersion ?? 'unknown';
    throw new Error(`Node.js ${minNodeMajor}+ and npm ${minNpmMajor}+ are required. Detected Node.js ${detectedNode}, npm ${detectedNpm}.`);
  }

  core.info(`Node.js version OK: ${check.nodeVersion}`);
  core.info(`npm version OK: ${check.npmVersion}`);
}
