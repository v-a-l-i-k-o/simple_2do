const Gio = imports.gi.Gio;
const Extension = imports.misc.extensionUtils.getCurrentExtension();

var getSettings = function() {
	let dir = Extension.dir.get_child('schemas').get_path();
	let source = Gio.SettingsSchemaSource.new_from_directory(dir,
			Gio.SettingsSchemaSource.get_default(),
			false);

	if(!source)
		throw new Error('Error Initializing the thingy.');

	let schema = source.lookup('org.gnome.shell.extensions.2do', false);

	if(!schema)
		throw new Error('Schema missing.');

	return new Gio.Settings({
		settings_schema: schema
	});
}

var generateHash = function(length = 9) {
	return Math.random().toString(18).slice(-length);
}
