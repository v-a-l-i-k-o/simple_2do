const { St, GLib, Gio, Shell, GObject, Clutter } = imports.gi;
const {
	panelMenu: PanelMenu,
	main: Main
} = imports.ui;

const Gettext = imports.gettext;
const _ = Gettext.domain('2do').gettext;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Constants = Extension.imports.constants;
const { Controller } = Extension.imports.controller;
const Helpers = Extension.imports.helpers;
const ControllerInstance = new Controller();
const Utils = Extension.imports.utils;

let todoApp;
let meta;
let todoFileList;

//----------------------------------------------------------------------

let TodoApp = GObject.registerClass(
class TodoButton extends PanelMenu.Button {
	_init() {
		super._init(1.0, '2Do Indicator', false);
		this.meta = meta;
		this.trashMode = false;

		// Locale
		let locales = this.meta.path + "/locale";
		Gettext.bindtextdomain('2do', locales);

		this._getTodoFileList();
		this._buildUI();
		this.refresh();
	}

	_getTodoFileList() {
		if (!GLib.file_test(Constants.TODO_FILE_PATH, GLib.FileTest.EXISTS))
			GLib.file_set_contents(Constants.TODO_FILE_PATH, Constants.TODO_FILE_INIT_DEFAULT);
		let [ok, contents] = GLib.file_get_contents(Constants.TODO_FILE_PATH);
		if (!ok) {
			throw new Error(`TODO: Something wrong with TodoFile. Check: ${Constants.TODO_FILE_PATH}`);
		}
		let dataString = Helpers.stringFromUTF8Array(contents);
		log('TODO: Parse todofilelist and save into let');
		todoFileList = JSON.parse(dataString);
	}

	_buildUI() {
		log('TODO: Build todoApp layouts');

		this.panelIndicator = new St.BoxLayout({
			vertical: false,
			y_align: Clutter.ActorAlign.CENTER,
			style: 'font-size: 12px;'
		});

        let indicatorIcon = new St.Icon({
            gicon: new Gio.ThemedIcon({
				name: 'text-editor-symbolic'
			}),
			icon_size: 15,
			style_class: 'todo-indicator-icon'
        });

		this.indicatorText = new St.Label({
			text:`( ${todoFileList.length} )`,
			style_class: 'todo-indicator-text'
		});

		this.panelIndicator.add_child(indicatorIcon);
		this.panelIndicator.add_child(this.indicatorText);

		this.add_child(this.panelIndicator);

		this.mainBox = new St.BoxLayout({
			vertical: true,
			style_class: 'todo-main-box',
			style: 'font-size: 15px;'
		});

		this.topBox = new St.BoxLayout({
			style_class: 'todo-top-box',
			vertical: false
		});

		this.taskEntry = new St.Entry({
			name: 'todo-entry',
			style_class: 'todo-entry',
			hint_text: _("Things needs to be done..."),
            track_hover: true,
            can_focus: true,
			reactive: true,
			x_expand: true
		});

		this.clutterTaskEntry = this.taskEntry.get_clutter_text();
		// this.clutterTaskEntry.set_max_length(Constants.MAX_TEXT_LENGTH);
        this._keyPressId = this.clutterTaskEntry.connect('key-press-event', (o, e) => {
			let symbol = e.get_key_symbol();
			if (
				symbol == Constants.KEY_RETURN ||
				symbol == Constants.KEY_ENTER
			) {
				this._addTask(o.get_text());
				this.clutterTaskEntry.set_text('');
				this.taskEntry.set_hint_text(_("Things needs to be done..."));
			}
		});

		this.topBox.add_child(this.taskEntry);

		this.tabsBox = new St.BoxLayout({
			style_class: 'todo-tabs-box',
			x_expand: true,
			y_align: Clutter.ActorAlign.CENTER,
			x_align: Clutter.ActorAlign.CENTER,
			vertical: false
		});

		this.tabActiveButton = new St.Button({
			name: 'tabActiveButton',
			width: 110,
			label: _('Active list'),
			style_class: 'todo-tab-button todo-tab-button--active'
		});

		this.tabArchiveButton = new St.Button({
			name: 'tabArchiveButton',
			width: 110,
			style_class: 'todo-tab-button',
			label: _('Recycle Bin')
		});

		this.tabActiveButton.connect('clicked', this._handleTabState.bind(this));
		this.tabArchiveButton.connect('clicked', this._handleTabState.bind(this));

		this.tabsBox.add_child(this.tabActiveButton);
		this.tabsBox.add_child(this.tabArchiveButton);

		this.scrollView = new St.ScrollView({
			style_class: 'todo-scroll-view',
			x_fill:true,
            y_fill: true,
            y_align: St.Align.START,
            x_align: St.Align.START,
            overlay_scrollbars: true
		});

		this.todosBox = new St.BoxLayout({
			style_class: 'todo-todos-box',
			vertical: true
		});

		this.scrollView.add_actor(this.todosBox);

		this.mainBox.add_child(this.topBox);
		this.mainBox.add_child(this.tabsBox);
		this.mainBox.add_child(this.scrollView);

		this.menu.box.add_child(this.mainBox);
		this.menu.connect('open-state-changed', this._handleMenuState.bind(this));
	}

	_handleMenuState() {

	}

	_handleTabState(actor) {
		if (!actor.has_style_class_name('todo-tab-button--active')) {
			let siblings = actor.get_parent().get_children();
			siblings.forEach((item, i) => {
				item.remove_style_class_name('todo-tab-button--active');
			});
			actor.add_style_class_name('todo-tab-button--active');
			this.trashMode = (actor.get_name() === 'tabArchiveButton') ? true : false;

			this.refresh();
		}
	}

	_addTask(title) {
		if (!title.trim()) return;

		log('TODO: Create new task');

		let newTask = {
			id: `${Utils.generateHash()}`,
			title: title,
			description: '',
			isDone: false,
			isArchived: false
		}

		todoFileList.push(newTask);
		ControllerInstance.syncTodoData(todoFileList);
	}

	_toggleTaskState(task) {
		if (this.trashMode) return;
		log('TODO: Switch tasks DONE param');
		todoFileList.find(({ id }) => id === task.id).isDone = !task.isDone;
		ControllerInstance.syncTodoData(todoFileList);
	}

	_archiveTask(task) {
		log('TODO: Archive task');
		todoFileList.find(({ id }) => id === task.id).isArchived = true;
		ControllerInstance.syncTodoData(todoFileList);
	}

	_restoreTask(task) {
		log('TODO: Restore task');
		todoFileList.find(({ id }) => id === task.id).isArchived = false;
		ControllerInstance.syncTodoData(todoFileList);
	}

	_removeTask(task) {
		log('TODO: Remove task');
		todoFileList.splice(todoFileList.indexOf(task), 1);
		ControllerInstance.syncTodoData(todoFileList);
	}

	refresh(file, otherFile, eventType) {
		const { DELETED, CREATED, CHANGES_DONE_HINT } = Gio.FileMonitorEvent;

		if (eventType === undefined || eventType === CHANGES_DONE_HINT) {
			log('TODO: Refresh todo app ui. Add listeners to buttons');
			this.todosBox.destroy_all_children();

			todoFileList
				.filter((item) => this.trashMode === item.isArchived)
				.forEach((item, i) => {
				let taskItem = new St.BoxLayout({
					y_align: Clutter.ActorAlign.CENTER,
					style_class: 'todo-task-item',
					opacity: item.isDone ? 130 : 255,
					reactive: true
				});

				let taskText = new St.Label({
					x_expand: true,
					text:_(`${item.title}`),
					style_class: `todo-tasktext ${item.isDone ? 'todo-tasktext--done' : ''}`
				});

				this.checkButton = new St.Icon({
					reactive: true,
		            gicon: new Gio.ThemedIcon({
						name: `${item.isArchived ? 'action-unavailable-symbolic'
							: item.isDone ? 'checkbox-checked-symbolic'
							: 'checkbox-symbolic'}`
					}),
					icon_size: 20,
					style_class: 'todo-check-button'
		        });

				this.deleteButton = new St.Icon({
					reactive: true,
		            gicon: new Gio.ThemedIcon({
						name: 'edit-clear-all-symbolic'
					}),
					icon_size: 18,
					style_class: 'todo-delete-button'
		        });

				this.archiveButton = new St.Icon({
					reactive: true,
		            gicon: new Gio.ThemedIcon({
						name: 'user-trash-symbolic'
					}),
					icon_size: 18,
					style_class: 'todo-archive-button'
		        });

				this.restoreButton = new St.Icon({
					reactive: true,
		            gicon: new Gio.ThemedIcon({
						name: 'edit-undo-symbolic'
					}),
					icon_size: 18,
					style_class: 'todo-restore-button'
		        });

				this._checkButtonReleaseId = this.checkButton.connect('button-release-event', () => this._toggleTaskState(item));

				taskItem.add_child(this.checkButton);
				taskItem.add_child(taskText);
				if (this.trashMode) {
					this._restoreButtonReleaseId = this.restoreButton.connect('button-release-event', () => this._restoreTask(item));
					this._deleteButtonReleaseId = this.deleteButton.connect('button-release-event', () => this._removeTask(item));
					taskItem.add_child(this.restoreButton);
					taskItem.add_child(this.deleteButton);
				} else {
					this._archiveButtonReleaseId = this.archiveButton.connect('button-release-event', () => this._archiveTask(item));
					taskItem.add_child(this.archiveButton);
				}

				this.todosBox.add_child(taskItem);
			});

			this.indicatorText.set_text(`( ${todoFileList.filter(item => !item.isDone && !item.isArchived).length} / ${todoFileList.filter(item => !item.isArchived).length} )`);

			this.taskEntry.hint_text = _("Things needs to be done...");
		}
	}

	enable() {
		ControllerInstance.init();
		ControllerInstance.enableMonitorTodoFile(this.refresh.bind(this));
	}

	disable() {
		log('TODO: Remove all handlers of signals');
		ControllerInstance.disableMonitorTodoFile();
		this.clutterTaskEntry.disconnect(this._keyPressId);
		this._keyPressId = 0;
		this.checkButton.disconnect(this._checkButtonReleaseId);
		this._checkButtonReleaseId = 0;
		if (this.trashMode) {
			this.restoreButton.disconnect(this._restoreButtonReleaseId);
			this.deleteButton.disconnect(this._deleteButtonReleaseId);
			this._restoreButtonReleaseId = 0;
			this._deleteButtonReleaseId = 0;
		} else {
			this.archiveButton.disconnect(this._archiveButtonReleaseId);
			this._archiveButtonReleaseId = 0;
		}
	}
});

//----------------------------------------------------------------------

// Init function
function init(metadata) {
	log('TODO: INIT');
	meta = metadata;
}

function enable() {
	log('TODO: ENABLE');
	todoApp = new TodoApp();
	todoApp.enable();
	Main.panel.addToStatusArea('todoApp', todoApp);
}

function disable() {
	log('TODO: DISABLE');
	todoApp.disable();
	log('TODO: DESTROY');
	todoApp.destroy();
	todoApp = null;
}

//----------------------------------------------------------------------
