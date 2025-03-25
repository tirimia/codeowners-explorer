# codeowners-explorer

Finally see each line in your CODEOWNERS file is affecting.

Simply hover over any line that contains a pattern and owners and see your file explorer light up!

## Installation

For now, just download it from the Github Releases in this repository.

## Customization
### Color
The highlight color can be overridden via
```json
"workbench.colorCustomizations": {
    "codeownersExplorer.highlight":"#<YOUR_COLOR_HERE>"
}
```
### Extras
Options are available under the `codeownersExplorer` namespace.
|Option|Purpose|Default|
|-|-|-|
|badge|An marker next to owned files| ""
|highlightParents|Highlight parent directories for easier scanning|true

