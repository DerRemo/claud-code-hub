// DE bundle for Claude Code Hub — populated in Task 6 from pre-v0.7.0 history plus v0.7.1 additions.
window.__I18N_BUNDLES = window.__I18N_BUNDLES || {};
window.__I18N_BUNDLES.de = {
  // Header
  'header.logoProduct': 'Claude Code',
  'header.sidebarToggleAria': 'Navigation umschalten',
  // Sidebar
  'sidebar.sessionsLabel': 'Sessions',
  'sidebar.navigationLabel': 'Navigation',
  'sidebar.loading': 'Lade…',
  'sidebar.noActiveSessions': 'Keine aktiven Sessions',
  'sidebar.nav.overview': 'Übersicht',
  'sidebar.nav.projects': 'Projekte',
  'sidebar.nav.usage': 'Usage',

  // Dashboard toolbar
  'dashboard.tablistAria': 'Dashboard-Tabs',
  'dashboard.tab.sessions': 'Sessions',
  'dashboard.tab.usage': 'Usage',
  'dashboard.tab.projects': 'Projekte',
  'dashboard.filterPlaceholder': 'Filter… (/)',
  'dashboard.layoutAria': 'Layout',
  'dashboard.layout.gridAria': 'Grid-Ansicht',
  'dashboard.layout.gridTitle': 'Grid (g)',
  'dashboard.layout.listAria': 'Listen-Ansicht',
  'dashboard.layout.listTitle': 'Liste (l)',
  'dashboard.refresh': 'Aktualisieren',
  'dashboard.bulkKill': 'Bulk beenden',
  'dashboard.newSession': 'Neue Session',
  'dashboard.newProject': 'Neues Projekt',

  // Dashboard empty states
  'dashboard.emptyNoMatchesHeading': 'Keine Treffer',
  'dashboard.emptyNoMatchesBody': 'Kein Session-Name oder Preview matcht „{q}".',
  'dashboard.emptyHeading': 'Keine aktiven Sessions',
  'dashboard.emptyBody': 'Starte eine neue Claude Code Session um loszulegen.',

  // Dashboard section headers
  'dashboard.section.active': 'Aktiv',
  'dashboard.section.dormant': 'Ruhend',
  'dashboard.section.foreign': 'Fremd',

  // Session card — status badges
  'sessionCard.status.working': 'Arbeitet',
  'sessionCard.status.needsInput': 'Braucht Input',
  'sessionCard.status.ready': 'Bereit',
  'sessionCard.status.active': 'Aktiv',
  'sessionCard.status.dormant': 'Ruhend',
  'sessionCard.status.workingTitle': 'Claude arbeitet gerade (ESC im Terminal zum Abbrechen)',
  'sessionCard.status.needsInputTitle': 'Claude wartet auf deinen Input',
  'sessionCard.status.readyTitle': 'Claude ist bereit für den nächsten Auftrag',
  'sessionCard.status.activeTitle': 'Session läuft, Zustand nicht erkennbar',
  'sessionCard.dormantBadgeTitle': 'Session ist nicht in tmux aktiv, kann wiederhergestellt werden',

  // Session card — mute button
  'sessionCard.mute.muteAria': 'Stummschalten',
  'sessionCard.mute.enableAria': 'Benachrichtigungen aktivieren',
  'sessionCard.mute.mutedTitle': 'Stummgeschaltet — klicken um zu aktivieren',
  'sessionCard.mute.enabledTitle': 'Benachrichtigungen an — klicken zum Stummschalten',

  // Session card — pin button
  'sessionCard.pin.pinAria': 'Anpinnen',
  'sessionCard.pin.pinnedAria': 'Angepinnt — klicken zum Loslösen',
  'sessionCard.pin.pinTitle': 'Anpinnen — Session ans Listenende ziehen',
  'sessionCard.pin.pinnedTitle': 'Angepinnt — klicken zum Loslösen',

  // Session card — actions
  'sessionCard.action.connect': 'Verbinden',
  'sessionCard.action.kill': 'Beenden',
  'sessionCard.action.restore': 'Wiederherstellen',
  'sessionCard.action.forget': 'Vergessen',
  'sessionCard.action.forgetTitle': 'Aus der Liste entfernen',
  'sessionCard.action.adopt': 'Adoptieren',

  // Session card — dormant metadata
  'sessionCard.lastSeen': 'Zuletzt gesehen: {time}',

  // Terminal toolbar buttons
  'terminal.toolbar.backAria': 'Zurück zum Dashboard',
  'terminal.toolbar.backTitle': 'Zurück',
  'terminal.toolbar.back': 'Zurück',
  'terminal.toolbar.filesAria': 'Dateien',
  'terminal.toolbar.filesTitle': 'Dateien anzeigen',
  'terminal.toolbar.files': 'Dateien',
  'terminal.toolbar.captureIdeaAria': 'Idee notieren',
  'terminal.toolbar.captureIdeaTitle': 'Idee ins Projekt-Backlog notieren',
  'terminal.toolbar.captureIdea': 'Idee notieren',
  'terminal.toolbar.killAria': 'Session beenden',
  'terminal.toolbar.killTitle': 'Session beenden',
  'terminal.toolbar.kill': 'Beenden',

  // Terminal connection status labels
  'terminal.connStatus.connecting': 'Verbinde',
  'terminal.connStatus.connected': 'Verbunden',
  'terminal.connStatus.reconnecting': 'Reconnect {n}/{max}',
  'terminal.connStatus.reconnectIn': 'Reconnect in 2s ({n}/{max})',
  'terminal.connStatus.disconnected': 'Getrennt',
  'terminal.connStatus.authMissing': 'Auth fehlt',
  'terminal.connStatus.sessionGone': 'Session weg',

  // Terminal inline messages (written into PTY)
  'terminal.msg.connLost': '── Verbindung verloren, reconnect {n}/{max} ──',
  'terminal.msg.connClosed': '── Verbindung getrennt, Reconnect-Limit erreicht ──',

  // Touch bar
  'terminal.touchBar.aria': 'Virtuelle Tasten',

  // File browser toolbar
  'filebrowser.toolbar.newFolder': '+ Ordner',
  'filebrowser.toolbar.newFolderTitle': 'Neuer Ordner',
  'filebrowser.toolbar.upload': '+ Datei',
  'filebrowser.toolbar.uploadTitle': 'Datei hochladen',
  'filebrowser.toolbar.refreshTitle': 'Neu laden',
  'filebrowser.toolbar.closeTitle': 'Schließen',

  // File browser tree
  'filebrowser.tree.loading': 'Lädt…',
  'filebrowser.tree.empty': 'leer',
  'filebrowser.tree.noSubdirs': '(keine Unterordner)',
  'filebrowser.tree.pickerEmpty': '(leer)',

  // File browser context menu
  'filebrowser.context.open': 'Öffnen',
  'filebrowser.context.download': 'Herunterladen',
  'filebrowser.context.rename': 'Umbenennen',
  'filebrowser.context.copyTo': 'Kopieren nach…',
  'filebrowser.context.moveTo': 'Verschieben nach…',
  'filebrowser.context.moveToTrash': 'In Papierkorb',
  'filebrowser.context.copyPath': 'Pfad kopieren',

  // File browser prompts & toasts
  'filebrowser.prompt.copy': 'Kopieren nach',
  'filebrowser.prompt.move': 'Verschieben nach',
  'filebrowser.prompt.targetPath': '{label} (relativer Zielpfad):',
  'filebrowser.prompt.newFolder': 'Neuer Ordner:',
  'filebrowser.toast.renameFailed': 'Umbenennen fehlgeschlagen',
  'filebrowser.toast.deleteFailed': 'Löschen fehlgeschlagen',
  'filebrowser.toast.copyFailed': 'Kopieren fehlgeschlagen',
  'filebrowser.toast.moveFailed': 'Verschieben fehlgeschlagen',
  'filebrowser.toast.createFailed': 'Anlegen fehlgeschlagen',
  'filebrowser.toast.cannotCreateFolder': 'Ordner erstellen nicht verfügbar',

  // File preview modal
  'preview.copyPathTitle': 'Pfad kopieren',
  'preview.copyPathLabel': 'Pfad',
  'preview.closeTitle': 'Schließen',
  'preview.closeLabel': '×',
  'preview.loading': 'Lädt…',
  'preview.tooLarge': 'Zu groß für Preview. Im Terminal öffnen.',
  'preview.unknownBinary': 'Unbekannter Binärtyp.',
  'preview.oversize.download': 'Datei herunterladen',

  // Upload toast stack
  'upload.status.queued': 'wartet',
  'upload.status.done': 'fertig',
  'upload.status.tooLargeClient': 'zu groß (Max 100 MB)',
  'upload.status.tooLargeServer': 'zu groß (Server)',
  'upload.status.exists': 'existiert',
  'upload.status.networkError': 'Netzwerkfehler',
  'upload.status.httpError': 'Fehler {status}',
  'upload.conflict.rename': 'Umbenennen',
  'upload.conflict.overwrite': 'Überschreiben',
  'upload.conflict.abort': 'Abbrechen',

  // Terminal drop overlay
  'terminal.dropOverlay.label': 'In Session-cwd hochladen',

  // Modals — New Session
  'modal.newSession.title': 'Neue Session starten',
  'modal.newSession.nameLabel': 'Session Name',
  'modal.newSession.namePlaceholder': 'z.B. kalvo-feature',
  'modal.newSession.dirLabel': 'Projektverzeichnis',
  'modal.newSession.cmdLabel': 'Startbefehl',
  'modal.newSession.cancel': 'Abbrechen',
  'modal.newSession.start': 'Starten',

  // Modals — Bulk Kill
  'modal.bulkKill.title': 'Idle-Sessions beenden',
  'modal.bulkKill.cancel': 'Abbrechen',
  'modal.bulkKill.confirm': 'Alle beenden',
  'modal.bulkKill.intro': 'Beende {count} Session{plural} ohne aktuelle Aktivität:',
  'modal.bulkKill.andMore': 'und {n} weitere…',

  // Modals — Adopt Session
  'modal.adopt.title': 'Session adoptieren',
  'modal.adopt.nameLabel': 'Neuer Name (ohne cc-Prefix)',
  'modal.adopt.cancel': 'Abbrechen',
  'modal.adopt.submit': 'Adoptieren',

  // Modals — Idea Capture
  'modal.idea.title': 'Idee notieren',
  'modal.idea.descLabel': 'Kurze Beschreibung',
  'modal.idea.descPlaceholder': 'z.B. Sidebar sollte sich merken welche Session zuletzt offen war',
  'modal.idea.cancel': 'Schließen',
  'modal.idea.save': 'Speichern',

  // Modals — New Project
  'modal.newProject.title': 'Neues Projekt anlegen',
  'modal.newProject.description': 'Lege eine neue <code>ROADMAP.md</code> unter einem bestehenden Verzeichnis an. Sie wird als Projekt registriert und taucht sofort im Projekte-Tab auf.',
  'modal.newProject.nameLabel': 'Anzeigename',
  'modal.newProject.namePlaceholder': 'z.B. Kalvo Backend',
  'modal.newProject.dirLabel': 'Projektverzeichnis',
  'modal.newProject.cancel': 'Abbrechen',
  'modal.newProject.create': 'Anlegen',

  // Toasts — session lifecycle
  'toast.downloadFailed': 'Download fehlgeschlagen',
  'toast.sessionHasOutput': '{name} hat Output',
  'toast.invalidToken': 'Token ungültig — bitte neu eingeben',
  'toast.connFailed': 'Verbindung zum Server fehlgeschlagen',
  'toast.connected': 'Verbunden mit {name}',
  'toast.authFailed': 'Auth fehlgeschlagen — Token ungültig',
  'toast.sessionGone': 'Session existiert nicht mehr',
  'toast.sessionKilled': 'Session „{name}" beendet',
  'toast.killFailed': 'Fehler beim Beenden der Session',
  'toast.noIdleSessions': 'Keine idle Sessions zum Beenden',
  'toast.bulkKillDone': '{n} Session{plural} beendet',
  'toast.bulkKillPartial': '{succeeded} beendet, {failed} fehlgeschlagen',
  'toast.sessionRestored': 'Session „{name}" wiederhergestellt',
  'toast.restoreConflict': 'Eine Session mit diesem Namen läuft bereits',
  'toast.restoreFailed': 'Wiederherstellen fehlgeschlagen',
  'toast.restoreConnError': 'Verbindungsfehler beim Wiederherstellen',
  'toast.sessionForgotten': '„{name}" vergessen',
  'toast.forgetFailed': 'Fehler beim Vergessen',
  'toast.adoptNameInUse': 'Ziel-Name bereits in Benutzung',
  'toast.adoptInvalidName': 'Ungültiger Name',
  'toast.adopted': '„{source}" adoptiert als „cc-{name}"',
  'toast.adoptFailed': 'Fehler beim Adoptieren',
  'toast.enterName': 'Bitte gib einen Namen ein',
  'toast.sessionStarted': 'Session „{name}" gestartet',
  'toast.sessionNameExists': 'Session mit diesem Namen existiert bereits',
  'toast.enterSessionName': 'Bitte gib einen Session-Namen ein',
  'toast.createSessionFailed': 'Fehler beim Erstellen der Session',
  'toast.projectCreated': 'Projekt „{name}" angelegt',
  'toast.enterDisplayName': 'Bitte Anzeigenamen eingeben',
  'toast.selectProjectDir': 'Bitte Projektverzeichnis auswählen',
  'toast.releaseMissingVersions': 'Release- und Dev-Version müssen gesetzt sein',
  'toast.releaseFailed': 'Release fehlgeschlagen: {message}',
  'toast.muteFailed': 'Mute fehlgeschlagen',
  'toast.notifMuted': 'Benachrichtigungen stumm',
  'toast.notifActive': 'Benachrichtigungen aktiv',
  'toast.pinFailed': 'Pinning fehlgeschlagen',
  'toast.pinOnlyKnown': 'Nur bekannte Sessions können gepinnt werden',
  'toast.sessionPinned': 'Session angepinnt',
  'toast.sessionUnpinned': 'Session losgelöst',
  'toast.copiedChars': 'Kopiert ({n} Zeichen)',
  'toast.copyFailed': 'Kopieren fehlgeschlagen — Zwischenablage nicht beschreibbar',
  'toast.pasteFailed': 'Einfügen fehlgeschlagen — Zwischenablage nicht lesbar. Firefox: Permission erlauben.',
  'toast.clipboardNotReadable': 'Zwischenablage nicht lesbar — bitte Browser-Permission erlauben',
  'toast.copyHint': 'Tipp: Shift+Drag oder Alt+Drag markiert und kopiert sofort',
  'toast.noActiveSession': 'Keine aktive Session',
  'toast.pushBlocked': 'Push blockiert — bitte in Browser-Einstellungen erlauben',
  'toast.pushSubFailed': 'Push-Subscription fehlgeschlagen: {message}',
  'toast.pushSubSaveFailed': 'Subscription konnte nicht gespeichert werden: {message}',
  'toast.pushEnabled': 'Push-Benachrichtigungen aktiviert',
  'toast.pushDisabled': 'Push-Benachrichtigungen deaktiviert',
  'toast.pushToggleFailed': 'Push-Benachrichtigungen umschalten fehlgeschlagen',
  'toast.vapidNotLoaded': 'VAPID-Key nicht geladen',
  'toast.ideaAdded': 'Idee ins Backlog geschrieben',

  // Confirm dialogs
  'confirm.killSession': 'Session „{name}" wirklich beenden?',
  'confirm.forgetSession': 'Eintrag „{name}" aus der Liste entfernen?\n\nDie Session wird nicht gekillt (sie läuft ja nicht mehr). Restore ist danach nicht mehr möglich.',

  // Tree picker (inside modals)
  'treePicker.loading': 'Lädt…',
  'treePicker.mkdir.button':       '+ Ordner',
  'treePicker.mkdir.title':        'Neuer Ordner',
  'treePicker.mkdir.placeholder':  'Ordnername…',
  'treePicker.mkdir.invalidName':  'Ungültiger Name',
  'treePicker.mkdir.exists':       'Existiert bereits',
  'treePicker.mkdir.failed':       'Anlegen fehlgeschlagen',

  // Session card — git badge
  'sessionCard.git.statusTitle': 'Git-Status',
  'sessionCard.git.dirtyTitle': 'Ungestagete Änderungen',

  // Session card — context tooltip
  'sessionCard.noClaudeData': 'Noch keine Claude-Code-Daten im cwd',

  // Login modal
  'login.title': 'Anmeldung',
  'login.hint': 'Auth-Token aus <code>.env</code> — wird einmalig im Browser gespeichert.',
  'login.tokenLabel': 'Token',
  'login.submit': 'Anmelden',

  // Keyboard help modal
  'kbdHelp.title': 'Tastaturkürzel',
  'kbdHelp.newSession': 'Neue Session',
  'kbdHelp.focusFilter': 'Filter fokussieren',
  'kbdHelp.reload': 'Sessions neu laden',
  'kbdHelp.gridLayout': 'Grid-Layout',
  'kbdHelp.listLayout': 'Listen-Layout',
  'kbdHelp.toggleTheme': 'Theme umschalten',
  'kbdHelp.backClose': 'Zurück / Schließen',
  'kbdHelp.thisHelp': 'Diese Hilfe',

  // Header — sound toggle (dynamic JS title)
  'header.soundOffTitle': 'Sound-Alerts AUS schalten',
  'header.soundOnTitle': 'Sound-Alerts AN schalten',

  // Projects list view
  'projects.loading': 'Lade Projekte…',
  'projects.authExpired': 'Auth abgelaufen.',
  'projects.missingBadge': 'ROADMAP.md fehlt',
  'projects.releasedLabel': 'released',
  'projects.devLabel': 'dev',
  'projects.progress': '{done}/{total} dev · {backlog} backlog',
  'projects.emptyNoFiles': 'keine ROADMAP.md-Dateien gefunden.',
  'projects.emptyInstruction': 'Lege eine ROADMAP.md in einem Projekt unter ~/Projects/* an — beim nächsten Server-Start wird sie automatisch registriert.',

  // Projects search
  'projects.search.header': 'Roadmap-Treffer für „{q}" ({count})',
  'projects.search.empty': 'Keine passenden Items gefunden.',

  // Project detail view
  'projects.detail.loading': 'Lade Projekt…',
  'projects.detail.notFound': 'Projekt nicht gefunden.',
  'projects.detail.roadmapNotReadable': 'ROADMAP.md nicht lesbar.',
  'projects.detail.roadmapMissingInstruction': 'Lege eine ROADMAP.md in diesem Verzeichnis an und starte den Server neu.',
  'projects.detail.openSessions': 'Offene Sessions ({n})',
  'projects.detail.loadingSessions': 'Lade Sessions…',
  'projects.detail.noSessions': 'Keine Session läuft in diesem Verzeichnis.',
  'projects.detail.sectionReleased': 'Released',
  'projects.detail.sectionDev': 'In Entwicklung',
  'projects.detail.sectionBacklog': 'Backlog / Ideen',
  'projects.detail.sectionChangelog': 'Changelog',
  'projects.detail.sectionEmpty': '— leer —',
  'projects.detail.addItem': '+ Item',
  'projects.detail.markAsDone': 'Als erledigt markieren',
  'projects.detail.markAsOpen': 'Als offen markieren',
  'projects.detail.deleteItem': 'Item löschen',
  'projects.detail.deleteTitle': 'Löschen',
  'projects.detail.confirmDelete': 'Löschen bestätigen',
  'projects.detail.newItemPlaceholder': 'Neues Item…',
  'projects.detail.inlineHint': 'Enter = speichern · Esc = abbrechen',
  'projects.detail.conflict': 'Konflikt — lade neu…',
  'projects.detail.itemAdded': 'Item hinzugefügt',
  'projects.detail.finalizeVersion': 'Version abschließen',
  'projects.detail.startSessionHere': 'Session hier starten',

  // Release modal
  'projects.release.title': 'Version abschließen',
  'projects.release.description': 'Alle Items aus <strong>In Entwicklung</strong> werden nach <strong>Released</strong> verschoben, beide Versions-Header gebumpt, und ein neuer Changelog-Eintrag oben eingefügt. Das ist eine destruktive Aktion — mach vorher einen Git-Commit der ROADMAP.md falls du sie versionierst.',
  'projects.release.versionLabel': 'Release-Version (wird als <code>## Released: vX</code> gesetzt)',
  'projects.release.versionPlaceholder': 'z.B. 0.3.0',
  'projects.release.newDevLabel': 'Neue Dev-Version (wird als <code>## In Entwicklung: vY</code> gesetzt)',
  'projects.release.newDevPlaceholder': 'z.B. 0.4.0',
  'projects.release.narrativeLabel': 'Changelog-Narrative (optional, freies Markdown — keine H2)',
  'projects.release.narrativePlaceholder': 'Was wurde in dieser Version gebaut? Mehrere Absätze sind ok.',
  'projects.release.cancel': 'Abbrechen',
  'projects.release.complete': 'Abschließen',
  'projects.release.finalized': 'v{version} abgeschlossen',

  // Usage dashboard — loading / error states
  'usage.loading': 'Lade Usage-Daten…',
  'usage.noData': 'Noch keine Daten vorhanden — Claude Code war diesen Monat noch nicht aktiv.',
  'usage.loadError': 'Fehler beim Laden: {message}',

  // Usage dashboard — limit status card
  'usage.limitStatus': 'Limit-Status',
  'usage.noLimitData': 'Keine Limit-Daten vorhanden',
  'usage.reset': 'Reset {time}',
  'usage.resetNow': 'Jetzt',
  'usage.limitResetBadge': '{window} Reset {time}',
  'usage.limitPeaks': 'Letzte 7 Tage: {peaks5h}x >90% (5h) · {peaks7d}x >90% (7d)',

  // Usage dashboard — heatmap
  'usage.heatmapTitle': 'Aktivität (Heatmap)',
  'usage.day.mon': 'Mo',
  'usage.day.tue': 'Di',
  'usage.day.wed': 'Mi',
  'usage.day.thu': 'Do',
  'usage.day.fri': 'Fr',
  'usage.day.sat': 'Sa',
  'usage.day.sun': 'So',

  // Usage dashboard — top projects
  'usage.topProjectsTitle': 'Top Projekte',

  // Usage dashboard — 30-day table
  'usage.tableTitle': '30-Tage-Tabelle',
  'usage.table.date': 'Datum',
  'usage.table.input': 'Input',
  'usage.table.output': 'Output',
  'usage.table.total': 'Gesamt',
  'usage.table.cost': 'Kosten',
  'usage.table.sessions': 'Sessions',

  // Usage dashboard — tool usage
  'usage.toolTitle': 'Tool-Nutzung',

  // Usage dashboard — work style
  'usage.workStyleTitle': 'Arbeitsweise',
  'usage.workStyleToolChains': 'Tool-Ketten {pct}% ({n})',
  'usage.workStyleDirectAnswers': 'Direkte Antworten {pct}% ({n})',

  // Usage dashboard — productivity
  'usage.productivityTitle': 'Produktivität',
  'usage.linesAdded': 'Zeilen hinzugefügt',
  'usage.linesRemoved': 'Zeilen entfernt',
  'usage.apiTime': 'API-Zeit',

  // Usage dashboard — summary cards
  'usage.card.monthlyCost': 'Kosten (Monat)',
  'usage.card.monthlySessions': 'Sessions (Monat)',
  'usage.card.monthlyCacheRate': 'Cache-Rate (Monat)',
  'usage.card.autonomousChains': 'Autonome Tool-Ketten',

  // Common / shared
  'common.errorWithMessage': 'Fehler: {message}',

  // Settings — sidebar entry + page
  'settings.sidebarEntry': 'Einstellungen',
  'settings.sidebarEntryAria': 'Einstellungen öffnen',
  'settings.pageTitle': 'Einstellungen',

  // Settings — section headers
  'settings.section.appearance': 'Erscheinungsbild',
  'settings.section.language': 'Sprache',
  'settings.section.notifications': 'Benachrichtigungen',
  'settings.section.help': 'Hilfe',
  'settings.section.about': 'Über',

  // Settings — Appearance section
  'settings.appearance.themeLabel': 'Theme',
  'settings.appearance.themeLight': 'Hell',
  'settings.appearance.themeDark': 'Dunkel',

  // Settings — Language section
  'settings.language.label': 'Oberflächensprache',
  'settings.language.english': 'English',
  'settings.language.german': 'Deutsch',
  'settings.language.reloadHint': 'Beim Umschalten wird die Seite neu geladen.',

  // Settings — Notifications section
  'settings.notifications.pushLabel': 'Push-Benachrichtigungen',
  'settings.notifications.push.permission.default': 'Berechtigung: noch nicht angefragt',
  'settings.notifications.push.permission.denied': 'Berechtigung: verweigert — in den Browser-Einstellungen erlauben',
  'settings.notifications.push.permission.granted': 'Berechtigung: erteilt',
  'settings.notifications.pushUnsupported': 'In diesem Browser nicht unterstützt',
  'settings.notifications.soundLabel': 'Ton-Alarme',

  // Settings — Help section
  'settings.help.kbdShortcutsLabel': 'Tastaturkürzel',

  // Settings — About section
  'settings.about.currentVersion': 'Aktuelle Version',
  'settings.about.latestVersion': 'Neuestes Release',
  'settings.about.viewRelease': 'Release anzeigen',
  'settings.about.uptimeLabel': 'Server-Uptime',
  'settings.about.newAvailable': '(neue Version verfügbar)',

  // Time / relative
  'time.unknown': 'unbekannt',
  'time.justNow': 'Gerade eben',
  'time.justNowLower': 'gerade eben',
  'time.mAgo': 'vor {n}m',
  'time.hAgo': 'vor {n}h',
  'time.dAgo': 'vor {n}d',
  'time.minAgo': 'vor {n} min',
  'time.daysAgo': 'vor {n} Tagen',
  'time.weeksAgo': 'vor {n} Wochen',
};
