# Change Log

## [0.1.0] - 2026-07-09

### Added

- **Start Wizard**: Visual start wizard with preset cards (Quick Start, Development, Kubernetes, Containerd, AI Workload) and custom configuration form with sliders, dropdowns, and environment variable editor
- **Status Bar**: Real-time status bar showing Colima state, active profile, CPU and memory. Click for quick actions menu
- **Profiles Tree View**: Sidebar listing all Colima profiles with status, resources, and runtime. Right-click context menu with Start, Stop, Restart, SSH, Status, Edit Config, and Delete actions
- **Containers Tree View**: Docker container listing with image, status, and ports. Context actions: Stop, Restart, Remove, Logs, Exec, Inspect
- **Kubernetes Tree View**: Pod listing grouped by namespace with status, readiness, restart count, and age
- **AI Models Tree View**: List pulled AI models with Run and Serve actions
- **Visual Config Editor**: Form-based editor for colima.yaml with automatic detection of immutable settings
- **Lifecycle Commands**: Start, Stop (graceful/force), Restart, Delete (with data option)
- **Profile Management**: Create, switch, and manage multiple Colima profiles
- **Kubernetes Management**: Start, Stop, Reset, Delete Kubernetes clusters
- **AI Model Management**: Pull, Run, Serve, and Setup AI models
- **Terminal Integration**: SSH into VM, Docker shell with socket configuration, container logs and exec
- **Auto-Refresh**: Configurable auto-refresh (5-120 seconds) for all tree views and status bar
- **Installation Detection**: Checks if Colima is installed on activation, offers to install via Homebrew
- **Error Handling**: Centralized error handling with "Show Output" action
- **Progress Notifications**: Progress indicators for long-running operations
- **Settings**: Configurable colima path, refresh interval, status bar visibility, and verbose logging
- **Keyboard Shortcuts**: Quick Start and Stop shortcuts
