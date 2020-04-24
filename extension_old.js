'use strict';

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

const Utils = Extension.imports.utils;
let extensionSettings = Utils.extensionSettings(); // Get settings from utils.js

const Config = imports.misc.config;
const SHELL_MINOR = parseInt(Config.PACKAGE_VERSION.split('.')[1]);

let indicator = null;

var TodoIndicator = class TodoIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, `${Extension.metadata.name} Indicator`, false);

        // Bind our indicator visibility to the GSettings value
        //
        // NOTE: Binding properties only works with GProperties (properties
        // registered on a GObject class), not native JavaScript properties
        extensionSettings.bind(
            'show-indicator',
            this.actor,
            'visible',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Watch the settings for changes
        this._onPanelStatesChangedId = extensionSettings.connect(
            'changed::panel-states',
            this._onPanelStatesChanged.bind(this)
        );

        // Keep record of the original state of each item
        this.states = {};

        // Read the saved states
        let variant = extensionSettings.get_value('panel-states');

        // Unpack the GSettings GVariant
        //
        // NOTE: `GSettings.get_value()` returns a GVariant, which is a
        // multi-type container for packed values. GJS has two helper functions:
        //
        //  * `GVariant.unpack()`
        //     This function will do a shallow unpacking of any variant type,
        //     useful for simple types like "s" (string) or "u" (uint32/Number).
        //
        //  * `GVariant.deep_unpack()`
        //     A deep, but non-recursive unpacking, such that our variant type
        //     "a{sb}" will be unpacked to a JS Object of `{ string: boolean }`.
        //     `GVariant.unpack()` would return `{ string: GVariant }`.
        this.saved = variant.deep_unpack();

        // Pick an icon
        let icon = new St.Icon({
            gicon: new Gio.ThemedIcon({name: 'face-laugh-symbolic'}),
            style_class: 'system-status-icon'
        });
        this.actor.add_child(icon);

        // Add a menu item for each item in the panel
        for (let name in Main.panel.statusArea) {
            // Remember this item's original visibility
            this.states[name] = Main.panel.statusArea[name].actor.visible;

            // Restore our settings
            if (name in this.saved) {
                log(`Restoring state of ${name}`);
                Main.panel.statusArea[name].actor.visible = this.saved[name];
            }

            this.menu.addAction(
                `Toggle "${name}"`,
                this.togglePanelItem.bind(this, name),
                null
            );
        }
    }

    _onPanelStatesChanged(settings, key) {
        // Read the new settings
        this.saved = extensionSettings.get_value('panel-states').deep_unpack();

        // Restore or reset the panel items
        for (let name in this.states) {
            // If we have a saved state, set that
            if (name in this.saved) {
                Main.panel.statusArea[name].actor.visible = this.saved[name];

            // Otherwise restore the original state
            } else {
                Main.panel.statusArea[name].actor.visible = this.states[name];
            }
        }
    }

    togglePanelItem(name) {
        log(`${name} menu item activated`);

        let statusItem = Main.panel.statusArea[name];
        statusItem.actor.visible = !statusItem.actor.visible;

        // Store our saved state
        this.saved[name] = statusItem.actor.visible;
    }

    _destroy() {
      // Stop watching the settings for changes
        extensionSettings.disconnect(this._onSettingsChangedId);

        // Store the panel settings in GSettings
        extensionSettings.set_value(
            'panel-states',
            new GLib.Variant('a{sb}', this.saved)
        );

        // Restore the visibility of the panel items
        for (let [name, visibility] of Object.entries(this.states)) {
            Main.panel.statusArea[name].actor.visible = visibility;
        }

      super.destroy();
    }
}

if (SHELL_MINOR > 31) {
    TodoIndicator = GObject.registerClass(
        {GTypeName: 'TodoIndicator'},
        TodoIndicator
    );
}

function init() {
    log(`-=2Do=-: initializing ${Extension.metadata.name}, v.${Extension.metadata.version}`);
}

function enable() {
    log(`-=2Do=-: enabling ${Extension.metadata.name}, v.${Extension.metadata.version}`);

    indicator = new TodoIndicator();

    Main.panel.addToStatusArea(`${Extension.metadata.name} Indicator`, indicator);
}

function disable() {
    log(`-=2Do=-: disabling ${Extension.metadata.name}, v.${Extension.metadata.version}`);

    if (indicator !== null) {
        indicator._destroy();
        indicator = null;
    }
}
