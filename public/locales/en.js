// EN bundle for Claude Code Hub — populated during i18n extraction tasks.
window.__I18N_BUNDLES = window.__I18N_BUNDLES || {};
window.__I18N_BUNDLES.en = {
  // Header
  'header.logoProduct': 'Claude Code',
  'header.sidebarToggleAria': 'Toggle navigation',
  'header.pushToggleAria': 'Toggle push notifications',
  'header.pushToggleTitle': 'Push notifications (works with tab closed)',
  'header.soundToggleAria': 'Toggle sound alerts',
  'header.soundToggleTitle': 'Toggle sound alerts',
  'header.themeToggleAria': 'Toggle theme',
  'header.themeToggleTitle': 'Toggle theme (t)',
  'header.kbdHelpAria': 'Show keyboard shortcuts',
  'header.kbdHelpTitle': 'Keyboard shortcuts (?)',

  // Sidebar
  'sidebar.sessionsLabel': 'Sessions',
  'sidebar.navigationLabel': 'Navigation',
  'sidebar.loading': 'Loading…',
  'sidebar.noActiveSessions': 'No active sessions',
  'sidebar.nav.overview': 'Overview',
  'sidebar.nav.projects': 'Projects',
  'sidebar.nav.usage': 'Usage',

  // Dashboard toolbar
  'dashboard.tablistAria': 'Dashboard tabs',
  'dashboard.tab.sessions': 'Sessions',
  'dashboard.tab.usage': 'Usage',
  'dashboard.tab.projects': 'Projects',
  'dashboard.filterPlaceholder': 'Filter… (/)',
  'dashboard.layoutAria': 'Layout',
  'dashboard.layout.gridAria': 'Grid view',
  'dashboard.layout.gridTitle': 'Grid (g)',
  'dashboard.layout.listAria': 'List view',
  'dashboard.layout.listTitle': 'List (l)',
  'dashboard.refresh': 'Refresh',
  'dashboard.bulkKill': 'Bulk Kill',
  'dashboard.newSession': 'New Session',
  'dashboard.newProject': 'New Project',

  // Dashboard empty states
  'dashboard.emptyNoMatchesHeading': 'No matches',
  'dashboard.emptyNoMatchesBody': 'No session name or preview matches "{q}".',
  'dashboard.emptyHeading': 'No active sessions',
  'dashboard.emptyBody': 'Start a new Claude Code session to get started.',

  // Dashboard section headers
  'dashboard.section.active': 'Active',
  'dashboard.section.dormant': 'Dormant',
  'dashboard.section.foreign': 'Foreign',

  // Session card — status badges
  'sessionCard.status.working': 'Working',
  'sessionCard.status.needsInput': 'Needs Input',
  'sessionCard.status.ready': 'Ready',
  'sessionCard.status.active': 'Active',
  'sessionCard.status.dormant': 'Dormant',
  'sessionCard.status.workingTitle': 'Claude is currently working (ESC in terminal to cancel)',
  'sessionCard.status.needsInputTitle': 'Claude is waiting for your input',
  'sessionCard.status.readyTitle': 'Claude is ready for the next task',
  'sessionCard.status.activeTitle': 'Session running, state unknown',
  'sessionCard.dormantBadgeTitle': 'Session is not active in tmux, can be restored',

  // Session card — mute button
  'sessionCard.mute.muteAria': 'Mute',
  'sessionCard.mute.enableAria': 'Enable notifications',
  'sessionCard.mute.mutedTitle': 'Muted — click to enable',
  'sessionCard.mute.enabledTitle': 'Notifications on — click to mute',

  // Session card — pin button
  'sessionCard.pin.pinAria': 'Pin',
  'sessionCard.pin.pinnedAria': 'Pinned — click to unpin',
  'sessionCard.pin.pinTitle': 'Pin — drag session to end of list',
  'sessionCard.pin.pinnedTitle': 'Pinned — click to unpin',

  // Session card — actions
  'sessionCard.action.connect': 'Connect',
  'sessionCard.action.kill': 'Kill',
  'sessionCard.action.restore': 'Restore',
  'sessionCard.action.forget': 'Forget',
  'sessionCard.action.forgetTitle': 'Remove from list',
  'sessionCard.action.adopt': 'Adopt',

  // Session card — dormant metadata
  'sessionCard.lastSeen': 'Last seen: {time}',

  // Terminal toolbar buttons
  'terminal.toolbar.backAria': 'Back to dashboard',
  'terminal.toolbar.backTitle': 'Back',
  'terminal.toolbar.back': 'Back',
  'terminal.toolbar.filesAria': 'Show files',
  'terminal.toolbar.filesTitle': 'Show files',
  'terminal.toolbar.files': 'Files',
  'terminal.toolbar.captureIdeaAria': 'Capture idea',
  'terminal.toolbar.captureIdeaTitle': 'Capture idea to project backlog',
  'terminal.toolbar.captureIdea': 'Capture idea',
  'terminal.toolbar.killAria': 'Kill session',
  'terminal.toolbar.killTitle': 'Kill session',
  'terminal.toolbar.kill': 'Kill',

  // Terminal connection status labels
  'terminal.connStatus.connecting': 'Connecting',
  'terminal.connStatus.connected': 'Connected',
  'terminal.connStatus.reconnecting': 'Reconnect {n}/{max}',
  'terminal.connStatus.reconnectIn': 'Reconnect in 2s ({n}/{max})',
  'terminal.connStatus.disconnected': 'Disconnected',
  'terminal.connStatus.authMissing': 'Auth missing',
  'terminal.connStatus.sessionGone': 'Session gone',

  // Terminal inline messages (written into PTY)
  'terminal.msg.connLost': '── Connection lost, reconnect {n}/{max} ──',
  'terminal.msg.connClosed': '── Connection closed, reconnect limit reached ──',

  // Touch bar
  'terminal.touchBar.aria': 'Virtual Keys',

  // File browser toolbar
  'filebrowser.toolbar.newFolder': '+ Folder',
  'filebrowser.toolbar.newFolderTitle': 'New Folder',
  'filebrowser.toolbar.upload': '+ File',
  'filebrowser.toolbar.uploadTitle': 'Upload File',
  'filebrowser.toolbar.refreshTitle': 'Refresh',
  'filebrowser.toolbar.closeTitle': 'Close',

  // File browser tree
  'filebrowser.tree.loading': 'Loading…',
  'filebrowser.tree.empty': 'Empty',
  'filebrowser.tree.noSubdirs': '(no subdirectories)',
  'filebrowser.tree.pickerEmpty': '(empty)',

  // File browser context menu
  'filebrowser.context.open': 'Open',
  'filebrowser.context.rename': 'Rename',
  'filebrowser.context.copyTo': 'Copy to…',
  'filebrowser.context.moveTo': 'Move to…',
  'filebrowser.context.moveToTrash': 'Move to Trash',
  'filebrowser.context.copyPath': 'Copy Path',

  // File browser prompts & toasts
  'filebrowser.prompt.copy': 'Copy to',
  'filebrowser.prompt.move': 'Move to',
  'filebrowser.prompt.targetPath': '{label} (relative target path):',
  'filebrowser.prompt.newFolder': 'New Folder:',
  'filebrowser.toast.renameFailed': 'Rename failed',
  'filebrowser.toast.deleteFailed': 'Delete failed',
  'filebrowser.toast.copyFailed': 'Copy failed',
  'filebrowser.toast.moveFailed': 'Move failed',
  'filebrowser.toast.createFailed': 'Create failed',
  'filebrowser.toast.cannotCreateFolder': 'Cannot create folder',

  // File preview modal
  'preview.copyPathTitle': 'Copy Path',
  'preview.copyPathLabel': 'Path',
  'preview.closeTitle': 'Close',
  'preview.closeLabel': '×',
  'preview.loading': 'Loading…',
  'preview.tooLarge': 'Too large for preview. Open in terminal.',
  'preview.unknownBinary': 'Unknown binary type.',

  // Upload toast stack
  'upload.status.queued': 'queued',
  'upload.status.done': 'done',
  'upload.status.tooLargeClient': 'too large (max 100 MB)',
  'upload.status.tooLargeServer': 'too large (server)',
  'upload.status.exists': 'exists',
  'upload.status.networkError': 'Network error',
  'upload.status.httpError': 'Error {status}',
  'upload.conflict.rename': 'Rename',
  'upload.conflict.overwrite': 'Overwrite',
  'upload.conflict.abort': 'Cancel',

  // Terminal drop overlay
  'terminal.dropOverlay.label': 'Upload to session directory',

  // Modals — New Session
  'modal.newSession.title': 'Start New Session',
  'modal.newSession.nameLabel': 'Session Name',
  'modal.newSession.namePlaceholder': 'e.g. kalvo-feature',
  'modal.newSession.dirLabel': 'Project Directory',
  'modal.newSession.cmdLabel': 'Start Command',
  'modal.newSession.cancel': 'Cancel',
  'modal.newSession.start': 'Start',

  // Modals — Bulk Kill
  'modal.bulkKill.title': 'Kill Idle Sessions',
  'modal.bulkKill.cancel': 'Cancel',
  'modal.bulkKill.confirm': 'Kill All',
  'modal.bulkKill.intro': 'Terminating {count} session{plural} without recent activity:',
  'modal.bulkKill.andMore': 'and {n} more…',

  // Modals — Adopt Session
  'modal.adopt.title': 'Adopt Session',
  'modal.adopt.nameLabel': 'New Name (without cc- prefix)',
  'modal.adopt.cancel': 'Cancel',
  'modal.adopt.submit': 'Adopt',

  // Modals — Idea Capture
  'modal.idea.title': 'Capture Idea',
  'modal.idea.descLabel': 'Short Description',
  'modal.idea.descPlaceholder': 'e.g. Sidebar should remember which session was last open',
  'modal.idea.cancel': 'Close',
  'modal.idea.save': 'Save',

  // Modals — New Project
  'modal.newProject.title': 'Create New Project',
  'modal.newProject.description': 'Create a new <code>ROADMAP.md</code> in an existing directory. It will be registered as a project and appear in the Projects tab.',
  'modal.newProject.nameLabel': 'Display Name',
  'modal.newProject.namePlaceholder': 'e.g. Kalvo Backend',
  'modal.newProject.dirLabel': 'Project Directory',
  'modal.newProject.cancel': 'Cancel',
  'modal.newProject.create': 'Create',

  // Toasts — session lifecycle
  'toast.sessionHasOutput': '{name} has output',
  'toast.invalidToken': 'Invalid token — please re-enter',
  'toast.connFailed': 'Connection to server failed',
  'toast.connected': 'Connected to {name}',
  'toast.authFailed': 'Auth failed — invalid token',
  'toast.sessionGone': 'Session no longer exists',
  'toast.sessionKilled': 'Session "{name}" killed',
  'toast.killFailed': 'Failed to kill session',
  'toast.noIdleSessions': 'No idle sessions to kill',
  'toast.bulkKillDone': '{n} session{plural} killed',
  'toast.bulkKillPartial': '{succeeded} killed, {failed} failed',
  'toast.sessionRestored': 'Session "{name}" restored',
  'toast.restoreConflict': 'A session with this name already exists',
  'toast.restoreFailed': 'Restore failed',
  'toast.restoreConnError': 'Connection error during restore',
  'toast.sessionForgotten': '"{name}" forgotten',
  'toast.forgetFailed': 'Forget failed',
  'toast.adoptNameInUse': 'Target name already in use',
  'toast.adoptInvalidName': 'Invalid name',
  'toast.adopted': '"{source}" adopted as "cc-{name}"',
  'toast.adoptFailed': 'Adopt failed',
  'toast.enterName': 'Please enter a name',
  'toast.sessionStarted': 'Session "{name}" started',
  'toast.sessionNameExists': 'Session with this name already exists',
  'toast.enterSessionName': 'Please enter a session name',
  'toast.createSessionFailed': 'Failed to create session',
  'toast.projectCreated': 'Project "{name}" created',
  'toast.enterDisplayName': 'Please enter a display name',
  'toast.selectProjectDir': 'Please select a project directory',
  'toast.releaseMissingVersions': 'Release and dev version must be set',
  'toast.releaseFailed': 'Release failed: {message}',
  'toast.muteFailed': 'Mute failed',
  'toast.notifMuted': 'Notifications muted',
  'toast.notifActive': 'Notifications active',
  'toast.pinFailed': 'Pin failed',
  'toast.pinOnlyKnown': 'Only known sessions can be pinned',
  'toast.sessionPinned': 'Session pinned',
  'toast.sessionUnpinned': 'Session unpinned',
  'toast.copiedChars': 'Copied ({n} chars)',
  'toast.copyFailed': 'Copy failed — clipboard not writable',
  'toast.pasteFailed': 'Paste failed — clipboard not readable. Firefox: allow permission.',
  'toast.clipboardNotReadable': 'Clipboard not readable — please allow browser permission',
  'toast.copyHint': 'Tip: Shift+Drag or Alt+Drag selects and copies instantly',
  'toast.noActiveSession': 'No active session',
  'toast.pushBlocked': 'Push blocked — please allow in browser settings',
  'toast.pushSubFailed': 'Push subscription failed: {message}',
  'toast.pushSubSaveFailed': 'Subscription could not be saved: {message}',
  'toast.pushEnabled': 'Push notifications enabled',
  'toast.pushDisabled': 'Push notifications disabled',
  'toast.vapidNotLoaded': 'VAPID key not loaded',
  'toast.ideaAdded': 'Idea added to backlog',

  // Confirm dialogs
  'confirm.killSession': 'Really kill session "{name}"?',
  'confirm.forgetSession': 'Remove entry "{name}" from the list?\n\nThe session will not be killed (it is no longer running). Restore will no longer be possible.',

  // Tree picker (inside modals)
  'treePicker.loading': 'Loading…',

  // Session card — git badge
  'sessionCard.git.statusTitle': 'Git status',
  'sessionCard.git.dirtyTitle': 'Unstaged changes',

  // Session card — context tooltip
  'sessionCard.noClaudeData': 'No Claude Code data in cwd yet',

  // Login modal
  'login.title': 'Login',
  'login.hint': 'Auth token from <code>.env</code> — stored once in your browser.',
  'login.tokenLabel': 'Token',
  'login.submit': 'Login',

  // Keyboard help modal
  'kbdHelp.title': 'Keyboard Shortcuts',
  'kbdHelp.newSession': 'New Session',
  'kbdHelp.focusFilter': 'Focus filter',
  'kbdHelp.reload': 'Reload sessions',
  'kbdHelp.gridLayout': 'Grid layout',
  'kbdHelp.listLayout': 'List layout',
  'kbdHelp.toggleTheme': 'Toggle theme',
  'kbdHelp.backClose': 'Back / Close',
  'kbdHelp.thisHelp': 'This help',

  // Header — sound toggle (dynamic JS title)
  'header.soundOffTitle': 'Turn sound alerts OFF',
  'header.soundOnTitle': 'Turn sound alerts ON',

  // Projects list view
  'projects.loading': 'Loading projects…',
  'projects.authExpired': 'Auth expired.',
  'projects.missingBadge': 'ROADMAP.md missing',
  'projects.releasedLabel': 'released',
  'projects.devLabel': 'dev',
  'projects.progress': '{done}/{total} dev · {backlog} backlog',
  'projects.emptyNoFiles': 'No ROADMAP.md files found.',
  'projects.emptyInstruction': 'Create a ROADMAP.md in a project under ~/Projects/* — it will be registered on the next server restart.',

  // Projects search
  'projects.search.header': 'Roadmap matches for "{q}" ({count})',
  'projects.search.empty': 'No matching items found.',

  // Project detail view
  'projects.detail.loading': 'Loading project…',
  'projects.detail.notFound': 'Project not found.',
  'projects.detail.roadmapNotReadable': 'ROADMAP.md not readable.',
  'projects.detail.roadmapMissingInstruction': 'Create a ROADMAP.md in this directory and restart the server.',
  'projects.detail.openSessions': 'Open Sessions ({n})',
  'projects.detail.loadingSessions': 'Loading sessions…',
  'projects.detail.noSessions': 'No session running in this directory.',
  'projects.detail.sectionReleased': 'Released',
  'projects.detail.sectionDev': 'In Development',
  'projects.detail.sectionBacklog': 'Backlog / Ideas',
  'projects.detail.sectionChangelog': 'Changelog',
  'projects.detail.sectionEmpty': '— empty —',
  'projects.detail.addItem': '+ Item',
  'projects.detail.markAsDone': 'Mark as done',
  'projects.detail.markAsOpen': 'Mark as open',
  'projects.detail.deleteItem': 'Delete item',
  'projects.detail.deleteTitle': 'Delete',
  'projects.detail.confirmDelete': 'Confirm delete',
  'projects.detail.newItemPlaceholder': 'New item…',
  'projects.detail.inlineHint': 'Enter = save · Esc = cancel',
  'projects.detail.conflict': 'Conflict — reloading…',
  'projects.detail.itemAdded': 'Item added',
  'projects.detail.finalizeVersion': 'Finalize version',
  'projects.detail.startSessionHere': 'Start session here',

  // Release modal
  'projects.release.title': 'Finalize version',
  'projects.release.description': 'All items from <strong>In Development</strong> will be moved to <strong>Released</strong>, both version headers bumped, and a new changelog entry inserted at the top. This is a destructive action — make a git commit of ROADMAP.md first if you version it.',
  'projects.release.versionLabel': 'Release Version (sets <code>## Released: vX</code>)',
  'projects.release.versionPlaceholder': 'e.g. 0.3.0',
  'projects.release.newDevLabel': 'New Dev Version (sets <code>## In Development: vY</code>)',
  'projects.release.newDevPlaceholder': 'e.g. 0.4.0',
  'projects.release.narrativeLabel': 'Changelog Narrative (optional, free Markdown — no H2)',
  'projects.release.narrativePlaceholder': 'What was built in this version? Multiple paragraphs are fine.',
  'projects.release.cancel': 'Cancel',
  'projects.release.complete': 'Complete',
  'projects.release.finalized': 'v{version} finalized',

  // Usage dashboard — loading / error states
  'usage.loading': 'Loading usage data…',
  'usage.noData': 'No data available — Claude Code was not active this month.',
  'usage.loadError': 'Load error: {message}',

  // Usage dashboard — limit status card
  'usage.limitStatus': 'Limit Status',
  'usage.noLimitData': 'No limit data available',
  'usage.reset': 'Reset {time}',
  'usage.resetNow': 'Now',
  'usage.limitResetBadge': '{window} Reset {time}',
  'usage.limitPeaks': 'Last 7 days: {peaks5h}x >90% (5h) · {peaks7d}x >90% (7d)',

  // Usage dashboard — heatmap
  'usage.heatmapTitle': 'Activity (Heatmap)',
  'usage.day.mon': 'Mon',
  'usage.day.tue': 'Tue',
  'usage.day.wed': 'Wed',
  'usage.day.thu': 'Thu',
  'usage.day.fri': 'Fri',
  'usage.day.sat': 'Sat',
  'usage.day.sun': 'Sun',

  // Usage dashboard — top projects
  'usage.topProjectsTitle': 'Top Projects',

  // Usage dashboard — 30-day table
  'usage.tableTitle': '30-Day Table',
  'usage.table.date': 'Date',
  'usage.table.input': 'Input',
  'usage.table.output': 'Output',
  'usage.table.total': 'Total',
  'usage.table.cost': 'Cost',
  'usage.table.sessions': 'Sessions',

  // Usage dashboard — tool usage
  'usage.toolTitle': 'Tool Usage',

  // Usage dashboard — work style
  'usage.workStyleTitle': 'Work Style',
  'usage.workStyleToolChains': 'Tool Chains {pct}% ({n})',
  'usage.workStyleDirectAnswers': 'Direct Answers {pct}% ({n})',

  // Usage dashboard — productivity
  'usage.productivityTitle': 'Productivity',
  'usage.linesAdded': 'Lines added',
  'usage.linesRemoved': 'Lines removed',
  'usage.apiTime': 'API time',

  // Usage dashboard — summary cards
  'usage.card.monthlyCost': 'Monthly Cost',
  'usage.card.monthlySessions': 'Monthly Sessions',
  'usage.card.monthlyCacheRate': 'Monthly Cache Rate',
  'usage.card.autonomousChains': 'Autonomous Tool Chains',

  // Common / shared
  'common.errorWithMessage': 'Error: {message}',
};
