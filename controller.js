const { GLib, Gio } = imports.gi;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Constants = Extension.imports.constants;

function Controller() {
    let monitor;

    this.init = function() {
        log('TODO: Init todoFile');
        if (!GLib.file_test(Constants.TODO_FILE_PATH, GLib.FileTest.EXISTS))
			GLib.file_set_contents(Constants.TODO_FILE_PATH, Constants.TODO_FILE_INIT_DEFAULT);
    }

    this.syncTodoData = function(data) {
        log('TODO: JSON stringify DATA and put into file');
        GLib.file_set_contents(Constants.TODO_FILE_PATH, JSON.stringify(data, null, '\t'));
    }

    this.enableTodoFileMonitor = function(func) {
        log('TODO: Add "file change" listener');
        let file = Gio.file_new_for_path(Constants.TODO_FILE_PATH);
        monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
        monitor.connect('changed', (obj, firstfile, otherFile, eventType) => func(firstfile, otherFile, eventType));
    }

    this.disableTodoFileMonitor = function() {
        log('TODO: Remove "file change" listener');
        monitor.cancel();
    }
}
