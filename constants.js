const { GLib } = imports.gi;

var TODO_FILE_PATH = GLib.get_home_dir() + '/.local/share/2do/2do.json';
var MAX_TEXT_LENGTH = 100;
var KEY_RETURN = 65293;
var KEY_ENTER  = 65421;
var TODO_FILE_INIT_DEFAULT = '[]';
