# setup-copilot-cli

GitHub Action to setup GitHub Copilot CLI in the workflow to use it in later steps.

This action installs [GitHub Copilot CLI](https://github.com/github/copilot-cli) on GitHub Actions runners, making it available for use in subsequent workflow steps.

## Features

- ✅ Supports all major platforms: Linux, macOS, and Windows
- ✅ Supports x64 and arm64 architectures
- ✅ Allows specifying a specific version or use the latest
- ✅ Automatically detects platform/architecture and installs accordingly
- ✅ Verifies installation and tests if CLI can be started
- ✅ Exits with failure if platform/architecture is unsupported

## Usage

### Basic Usage

```yaml
- name: Setup GitHub Copilot CLI
  uses: mvkaran/setup-copilot-cli@v1
```

### With Specific Version

```yaml
- name: Setup GitHub Copilot CLI
  uses: mvkaran/setup-copilot-cli@v1
  with:
    version: 'v0.0.369'
```

### With Prerelease Version

```yaml
- name: Setup GitHub Copilot CLI
  uses: mvkaran/setup-copilot-cli@v1
  with:
    version: 'prerelease'
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
      
      - name: Verify Copilot CLI
        run: copilot --version
      
      - name: Use Copilot CLI
        run: |
          echo "Copilot CLI is now available!"
          copilot --help
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `version` | Version of Copilot CLI to install. Can be `latest`, `prerelease`, or a specific version like `v0.0.369` | No | `latest` |
| `token` | GitHub token for authentication (exported as `GH_TOKEN`). Recommended so the action can validate Copilot CLI startup. | No | `${{ github.token }}` |

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

- name: Display Copilot Info
  run: |
    echo "Installed version: ${{ steps.copilot-setup.outputs.version }}"
    echo "Installed path: ${{ steps.copilot-setup.outputs.path }}"
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
3. Installs Copilot CLI using npm (works on all platforms)
4. Falls back to the install script for Linux/macOS if npm installation fails
5. Verifies the installation. If `token` is provided, the action validates that Copilot CLI starts successfully. If no token is provided, the action only validates the binary is on PATH and the version matches the requested one.
6. Adds Copilot CLI to the PATH for use in subsequent steps

## Troubleshooting

### Installation Failed

If the action fails to install Copilot CLI:
- Check that your runner has internet access
- Verify that npm is available on the runner
- Check the action logs for specific error messages

If verification fails and you provided `token`, ensure the token is valid for Copilot CLI and that it is passed as `token` (exported to `GH_TOKEN`). Without a token, the action only validates the binary and version, not runtime startup.

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

