const { Gtk, GObject } = imports.gi;
const { extensionUtils: ExtensionUtils } = imports.misc;
const Gettext = imports.gettext;

const Extension = ExtensionUtils.getCurrentExtension();
const Convenience = Extension.imports.convenience;
const Constants = Extension.imports.constants;
const _ = Gettext.domain(Extension.metadata['gettext-domain']).gettext;

// ToDo Preferences Widget
var ToDoPreferencesWidget = GObject.registerClass(
class ToDoPreferencesWidget extends Gtk.Box {
    _init() {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5,
            border_width: 5
        });

        this._settings = Convenience.getSettings(Constants.SCHEMA);

        let settingsPage = new SettingsPage(this._settings);

        this.add(settingsPage);
    }
});

function init() {
    Convenience.initTranslations(Extension.metadata['gettext-domain']);
}

function buildPrefsWidget() {
    let widget = new ToDoPreferencesWidget();
    widget.show_all();
    return widget;
}

var NotebookPage = GObject.registerClass(
class ToDo_NotebookPage extends Gtk.Box {
    _init(title) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            margin: 24,
            spacing: 20,
            homogeneous: false
        });

        this._title = new Gtk.Label({
            label: "<b>" + title + "</b>",
            use_markup: true,
            xalign: 0
        });
    }

    getTitleLabel() {
        return this._title;
    }
});

var FrameBox = GObject.registerClass(
class ToDo_FrameBox extends Gtk.Frame {
    _init() {
        super._init({ label_yalign: 0.50 });
        this._listBox = new Gtk.ListBox();
        this._listBox.set_selection_mode(Gtk.SelectionMode.NONE);
        this.count = 0;
        Gtk.Frame.prototype.add.call(this, this._listBox);
    }

    add(boxRow) {
        this._listBox.add(boxRow);
        this.count++;
    }

    show() {
        this._listBox.show_all();
    }

    length() {
        return this._listBox.length;
    }

    remove(boxRow) {
        this._listBox.remove(boxRow);
        this.count = this.count--;
    }

    remove_all_children() {
        let children = this._listBox.get_children();
        for(let i = 0; i < children.length; i++) {
            let child = children[i];
            this._listBox.remove(child);
        }
        this.count = 0;
        this._listBox.show_all();
    }

    get_index(index){
        return this._listBox.get_row_at_index(index);
    }

    insert(row, pos){
        this._listBox.insert(row, pos);
        this.count++;
    }
});

var FrameBoxRow = GObject.registerClass(
class ToDo_FrameBoxRow extends Gtk.ListBoxRow {
    _init() {
        super._init({});
        this._grid = new Gtk.Grid({
            margin: 5,
            column_spacing: 20,
            row_spacing: 20
        });

        Gtk.ListBoxRow.prototype.add.call(this, this._grid);
    }

    add(widget) {
        this._grid.add(widget);
    }
});

// Settings Page
var SettingsPage = GObject.registerClass(
class Todo_SettingsPage extends NotebookPage {

    _init(settings) {
        super._init(_('Settings'));
        this._settings = settings;
        this.fontSize = this._settings.get_int('todo-font-size');
        this.tasksAmount = this._settings.get_int('todo-tasks-amount');
        this.toDoFrame = new FrameBox();
        this._createLayout();
    }

    _createLayout() {
        // FONT SIZE------------------------------------------------------------
        let fontSizeRow = new FrameBoxRow();
        let fontSizeLabel = new Gtk.Label({
            label: _('Font size'),
            xalign: 0,
            hexpand: true
        });
        let fontScale = new Gtk.HScale({
                adjustment: new Gtk.Adjustment({
                    lower: 12, upper: 18, step_increment: 1, page_increment: 1, page_size: 0
                }),
                digits: 0, round_digits: 0, hexpand: true,
                value_pos: Gtk.PositionType.RIGHT
        });
        fontScale.connect('format-value', (scale, value) => { return value.toString() + 'px'; });
        fontScale.set_value(this.fontSize);
        fontScale.connect('value-changed', () => {
            this.fontSize = fontScale.get_value();
            this._settings.set_int('todo-font-size', this.fontSize);
        });
        fontSizeRow.add(fontSizeLabel);
        fontSizeRow.add(fontScale);
        this.toDoFrame.add(fontSizeRow);

        // TASKS AMOUNT FOR DISPLAYING------------------------------------------
        let tasksAmountRow = new FrameBoxRow();
        let tasksAmountLabel = new Gtk.Label({
            label: _('Tasks amount'),
            xalign: 0,
            hexpand: true,
            has_tooltip: true,
            tooltip_text: _('Max amount of tasks, which display without scrolling.')
        });
        let tasksAmountScale = new Gtk.HScale({
                adjustment: new Gtk.Adjustment({
                    lower: 4, upper: 10, step_increment: 1, page_increment: 1, page_size: 0
                }),
                digits: 0, round_digits: 0, hexpand: true,
                value_pos: Gtk.PositionType.RIGHT
        });
        tasksAmountScale.connect('format-value', (scale, value) => { return value.toString() + ' items'; });
        tasksAmountScale.set_value(this.tasksAmount);
        tasksAmountScale.connect('value-changed', () => {
            this.tasksAmount = tasksAmountScale.get_value();
            this._settings.set_int('todo-tasks-amount', this.tasksAmount);
        });
        tasksAmountRow.add(tasksAmountLabel);
        tasksAmountRow.add(tasksAmountScale);
        this.toDoFrame.add(tasksAmountRow);

        this.add(this.toDoFrame);
    }
});
