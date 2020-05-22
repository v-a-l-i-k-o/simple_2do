const { GLib, Gio } = imports.gi;
const {	main: Main } = imports.ui;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const { TodoApp } = Extension.imports.extension_components;
const Constants = Extension.imports.constants;
const Convenience = Extension.imports.convenience;

var TodoAppController = class {
    constructor() {
        this.settings = Convenience.getSettings(Constants.SCHEMA);
        this._settingsChangeIds = [];
        this._appSignalsIds = [];
        this._monitor = null;
        this.todoApp = null;
    }

    init() {
        log('TODO: Init todoFile');
        if (!GLib.file_test(Constants.TODO_FILE_PATH, GLib.FileTest.EXISTS))
			GLib.file_set_contents(Constants.TODO_FILE_PATH, Constants.TODO_FILE_INIT_DEFAULT);
        this._bindSettingsChanges();
        this._enableTodoFileMonitor();
        this.todoApp = new TodoApp(this.settings);
        Main.panel.addToStatusArea('todoApp', this.todoApp);
        this._bindAppSignals();
    }

    _syncTodoData() {
        log('TODO: JSON stringify DATA and put into file');
        GLib.file_set_contents(Constants.TODO_FILE_PATH, JSON.stringify(this.todoApp.todoFile, null, '\t'));
    }

    _bindSettingsChanges() {
        log('TODO: Add "settings change" listeners');
        this._settingsChangeIds = [
            this.settings.connect('changed::todo-font-size', this._reloadTodoApp.bind(this)),
            this.settings.connect('changed::todo-tasks-amount', this._refreshTodoList.bind(this))
        ];
    }

    _bindAppSignals() {
        this._appSignalsIds = [
            this.todoApp.connect('on-todo-file-changed', this._syncTodoData.bind(this))
        ];
    }

    _enableTodoFileMonitor() {
        log('TODO: Add "file change" listener');
        let file = Gio.file_new_for_path(Constants.TODO_FILE_PATH);
        this._monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
        this._monitor.connect('changed', (obj, firstfile, otherFile, eventType) => this.todoApp.refreshTodoList(firstfile, otherFile, eventType));
    }

    _reloadTodoApp() {
        this.todoApp.reloadApp();
    }

    _refreshTodoList() {
        this.todoApp.refreshTodoList();
    }

    _disableTodoFileMonitor() {
        log('TODO: Remove "file change" listener');
        this._monitor.cancel();
    }

    stop() {
        this._disableTodoFileMonitor();
        log('TODO: Remove "settings change" listeners');
        this._settingsChangeIds.forEach(id => this.settings.disconnect(id));
        this._appSignalsIds.forEach(id => this.todoApp.disconnect(id));
        this.settings = null;
    }

    destroy() {
        this.todoApp.destroy();
    }
}
