# Pokechill Plus

Tampermonkey script for [Pokechill](https://github.com/play-pokechill/play-pokechill.github.io) with auto-fight and item tracking.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

- Auto-click "Fight Again" button
- Track dropped items in real-time
- Draggable overlay
- Keyboard shortcuts

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Click here: [Install Script](https://raw.githubusercontent.com/TZY-1/pokechill-plus/main/pokechill-plus.user.js)
3. Click "Install" in Tampermonkey

## Usage

- `Ctrl+Space` - Start/Stop
- `Ctrl+D` - Toggle debug mode
- Click and drag overlay to move it
- Click Reset button to clear stats

## How it works

The script monitors the `#area-rejoin` button and clicks it every 250ms when available. Items from `#explore-drops` are tracked and displayed with their counts.

Item tracking only counts items dropped **after** starting the tool. The current state is captured as baseline when you press Start.

## License

MIT License - see [LICENSE](LICENSE)

## Disclaimer

This tool is for educational purposes. Using automation tools may violate Pokechill's Terms of Service. Use at your own risk.