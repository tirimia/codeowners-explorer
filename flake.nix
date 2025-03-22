{
  description = "CODEOWNERS explorer VSCode extension";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    vscode-extensions = {
      url = "github:nix-community/nix-vscode-extensions";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "flake-utils";
    };
  };
  outputs = inputs:
    inputs.flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import inputs.nixpkgs {
        overlays = [ inputs.vscode-extensions.overlays.default ];
        config.allowUnfree = true;
        inherit system;
      };
      devCode = pkgs.vscode-with-extensions.override {
        vscode = pkgs.vscode;
        vscodeExtensions = [
          # Could not find these two in regular nixpkgs
          pkgs.vscode-marketplace.amodio.tsl-problem-matcher
          pkgs.vscode-marketplace.ms-vscode.extension-test-runner
          pkgs.vscode-marketplace.connor4312.esbuild-problem-matchers
          pkgs.vscode-extensions.dbaeumer.vscode-eslint
        ];
      };
    in {
      packages.devCode = devCode;
      devShells.default = pkgs.mkShell {
        buildInputs = [pkgs.pnpm];
      };
    });
}
