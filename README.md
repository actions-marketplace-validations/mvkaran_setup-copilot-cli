# setup-copilot-cli

GitHub Action to setup GitHub Copilot CLI in the workflow to use it in later steps.

This action installs [GitHub Copilot CLI](https://github.com/github/copilot-cli) on GitHub Actions runners, making it available for use in subsequent workflow steps.

## Features

- ✅ Supports all major platforms: Linux, macOS, and Windows
- ✅ Supports x64 and arm64 architectures
- ✅ Allows specifying a specific version or use the latest
- ✅ Automatically detects platform/architecture and installs accordingly
- ✅ Simplifies token setup by exporting GH_TOKEN for Copilot CLI
- ✅ Exits with failure if platform/architecture is unsupported

## Usage

### Basic Usage (Recommended)

Set the token during setup for convenience in all subsequent steps:

```yaml
- name: Setup GitHub Copilot CLI
  uses: mvkaran/setup-copilot-cli@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Use Copilot CLI
  run: copilot -i "explain how to read a file in Python"
```

### Installation Only (Set Token Later)

Install without token and provide it when using the CLI:

```yaml
- name: Setup GitHub Copilot CLI
  uses: mvkaran/setup-copilot-cli@v1
  # No token provided during installation

- name: Use Copilot CLI with token
  run: copilot -i "explain how to read a file in Python"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### With Specific Version

```yaml
- name: Setup GitHub Copilot CLI
  uses: mvkaran/setup-copilot-cli@v1
  with:
    version: 'v0.0.369'
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Use Copilot CLI
  run: copilot -i "write a function to parse JSON"
```

### With Prerelease Version

```yaml
- name: Setup GitHub Copilot CLI
  uses: mvkaran/setup-copilot-cli@v1
  with:
    version: 'prerelease'
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Use Copilot CLI
  run: copilot --help
```

### Complete Workflow Example

```yaml
name: Use Copilot CLI
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup GitHub Copilot CLI
        uses: mvkaran/setup-copilot-cli@v1
        with:
          version: 'latest'
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Check Copilot CLI version
        run: copilot --version
      
      - name: Ask Copilot for help
        run: copilot -i "how to create a Python virtual environment"
      
      - name: Use Copilot with piped input
        run: |
          echo "Explain this code" | copilot -i "$(cat README.md)"
```

### Using Environment Variables (Alternative)

If you prefer not to use the `token:` input, you can set environment variables directly:

```yaml
- name: Setup GitHub Copilot CLI
  uses: mvkaran/setup-copilot-cli@v1
  with:
    version: 'latest'
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `version` | Version of Copilot CLI to install. Can be `latest`, `prerelease`, or a specific version like `v0.0.369` | No | `latest` |
| `token` | GitHub token for Copilot CLI authentication. **Recommended:** This token is exported as `GH_TOKEN` environment variable for convenience in subsequent steps. If not provided, you must set the token when actually using the CLI. | No | (none) |

### Authentication: When is the Token Needed?

**Important:** The token is **NOT** required for installing Copilot CLI. It's only needed when **USING** the CLI.

This action provides two convenient approaches:

**Approach 1: Set token during setup (Recommended)**
```yaml
- name: Setup GitHub Copilot CLI
  uses: mvkaran/setup-copilot-cli@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}  # Exported as GH_TOKEN

- name: Use Copilot CLI
  run: copilot -i "your prompt"  # Token already available
```

**Approach 2: Set token when using the CLI**
```yaml
- name: Setup GitHub Copilot CLI
  uses: mvkaran/setup-copilot-cli@v1
  # No token during installation

- name: Use Copilot CLI
  run: copilot -i "your prompt"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Token provided here
```

Both approaches work identically - choose based on your preference. Setting the token during setup is more convenient if you'll use Copilot CLI in multiple steps.

## Outputs

| Output | Description |
|--------|-------------|
| `version` | The installed version of Copilot CLI |
| `path` | Path to the Copilot CLI executable |

### Using Outputs

```yaml
- name: Setup GitHub Copilot CLI
  id: copilot-setup
  uses: mvkaran/setup-copilot-cli@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Display Copilot Info
  run: |
    echo "Installed version: ${{ steps.copilot-setup.outputs.version }}"
    echo "Installed path: ${{ steps.copilot-setup.outputs.path }}"

- name: Use Copilot CLI
  run: copilot -i "generate a bash script to backup files"
```

## Platform Support

This action supports the following platforms and architectures:

| Platform | x64 | arm64 |
|----------|-----|-------|
| Linux | ✅ | ✅ |
| macOS | ✅ | ✅ |
| Windows | ✅ | ✅ |

If your workflow runs on an unsupported platform or architecture, the action will fail with a clear error message.

## Prerequisites

- An active GitHub Copilot subscription. See [Copilot plans](https://github.com/features/copilot/plans).
- If using Copilot via an organization, ensure it's not disabled by your organization administrator.

### Authenticate with a Personal Access Token (PAT)

Authenticate using a fine-grained PAT with the **Copilot Requests** permission enabled and pass it through the action input.

1. Visit https://github.com/settings/personal-access-tokens/new
2. Under **Permissions**, click **Add permissions** and select **Copilot Requests**
3. Generate your token
4. Pass the token to the action via the `token` input

You can alternatively set the token directly via the environment variables `GH_TOKEN` or `GITHUB_TOKEN` (in order of precedence) and leave the `token` input blank; the CLI will authenticate using the first available token.

## How It Works

1. Detects the runner's platform (Linux, macOS, Windows) and architecture (x64, arm64)
2. Validates that the platform/architecture combination is supported
3. If a `token` input is provided, exports it as the `GH_TOKEN` environment variable (for convenience in later steps)
4. Installs Copilot CLI using npm (works on all platforms)
5. Falls back to the install script for Linux/macOS if npm installation fails
6. Verifies the installation by checking that the CLI binary is available and the version matches
7. Adds Copilot CLI to the PATH for use in subsequent steps

**Note:** 
- The token is **only needed when using the CLI**, not for installation
- This action does not verify authentication - Copilot CLI authenticates when you first use it
- You can install without a token and provide it later when running CLI commands

## Troubleshooting

### Authentication Issues

If Copilot CLI cannot authenticate:
- Ensure you've provided a token either via the `token:` input or `GH_TOKEN`/`GITHUB_TOKEN` environment variables
- Verify that your token has the necessary Copilot permissions
- Check that you have an active Copilot subscription

### Installation Failed

If the action fails to install Copilot CLI:
- Check that your runner has internet access
- Verify that npm is available on the runner
- Check the action logs for specific error messages

### Unsupported Platform/Architecture

If you see an error about unsupported platform or architecture:
- Verify your runner configuration
- Check the [Platform Support](#platform-support) section to see supported combinations
- Consider using a different runner type

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related

- [GitHub Copilot CLI](https://github.com/github/copilot-cli)
- [GitHub Copilot CLI Documentation](https://docs.github.com/copilot/concepts/agents/about-copilot-cli)

