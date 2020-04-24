const { GLib, Gio } = imports.gi;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Constants = Extension.imports.constants;

function Controller() {
    let fileM;
    let monitor;

    this.init = function() {
        log('TODO: Init fileM, monitor');
        fileM = Gio.file_new_for_path(Constants.TODO_FILE_PATH);
        monitor = fileM.monitor(Gio.FileMonitorFlags.NONE, null);
    }

    this.syncTodoData = function(data) {
        log('TODO: JSON stringify DATA and push to server');
        GLib.file_set_contents(Constants.TODO_FILE_PATH, JSON.stringify(data, null, '\t'));
    }

    this.enableMonitorTodoFile = function(func) {
        log('TODO: Add listener on file change');
        monitor.connect('changed', (obj, file, otherFile, eventType) => func(file, otherFile, eventType));
    }

    this.disableMonitorTodoFile = function() {
        log('TODO: Remove listener on file change');
        monitor.cancel();
    }
}
