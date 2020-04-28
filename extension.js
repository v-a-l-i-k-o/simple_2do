const { St, GLib, Gio, Shell, GObject, Clutter } = imports.gi;
const {
	panelMenu: PanelMenu,
	popupMenu: PopupMenu,
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
		super._init(0.0, 'Simple 2Do', false);
		this.meta = meta;
		this.trashMode = false;

		// Locale
		let locales = this.meta.path + "/locale";
		Gettext.bindtextdomain('2do', locales);

		ControllerInstance.init();

		this.start();
		this._getTodoFileList();

		if (Main.panel._menus === undefined)
            Main.panel.menuManager.addMenu(this.menu);
        else
            Main.panel._menus.addMenu(this.menu);

		this._buildUI();
		this.onRefresh();
	}

	_getTodoFileList() {
		log('TODO: Get todoFile from home directory');
		let [ok, contents] = GLib.file_get_contents(Constants.TODO_FILE_PATH);
		if (!ok) {
			throw new Error(`TODO: Something wrong with todoFile. Check: ${Constants.TODO_FILE_PATH}`);
		}
		let dataString = Helpers.stringFromUTF8Array(contents);
		log('TODO: Parse todoFile string');
		todoFileList = JSON.parse(dataString);
	}

	_getActiveTasksCount() {
		return todoFileList.filter(item => item && !item.isDone && !item.isArchived).length;
	}

	_getAvailableTasksCount() {
		return todoFileList.filter(item => item && !item.isArchived).length;
	}

	_buildUI() {
		log('TODO: Build todoApp layouts');
		this._activeTasksCount = this._getActiveTasksCount();
		this._notArchivedTasksCount = this._getAvailableTasksCount();

		let panelIndicator = new St.BoxLayout();

        let indicatorIcon = new St.Icon({
            gicon: new Gio.ThemedIcon({
				name: 'text-editor-symbolic'
			}),
			icon_size: 15,
			style_class: 'todo-indicator-icon'
        });

		this._indicatorText = new St.Label({
			text: '',
			y_align: Clutter.ActorAlign.CENTER,
			style: 'font-size: 12px;',
			style_class: 'todo-indicator-text'
		});

		panelIndicator.add_child(indicatorIcon);
		panelIndicator.add_child(this._indicatorText);
		this.add_child(panelIndicator);

		this.mainBox = new St.BoxLayout({
			vertical: true,
			x_expand: true,
			style_class: 'todo-main-box',
			style: 'font-size: 16px;'
		});

		this.topBox = new St.BoxLayout({
			style_class: 'todo-top-box',
			vertical: true
		});

		this.taskEntry = new St.Entry({
			name: 'todoEntry',
			style_class: 'todo-entry',
			hint_text: _("Things needs to be done..."),
            can_focus: true,
			reactive: true,
			x_expand: true
		});

		this.clutterTaskEntry = this.taskEntry.get_clutter_text();
        this.clutterTaskEntry.connect('key-press-event', (actor, e) => {
			let symbol = e.get_key_symbol();
			if (
				symbol == Constants.KEY_RETURN ||
				symbol == Constants.KEY_ENTER
			) {
				this._addTask(actor.get_text());
				actor.set_text('');
				this.taskEntry.set_hint_text(_("Things needs to be done..."));
				this._handleTabState(this.tabActiveButton, false);
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
			width: 125,
			height: 35,
			reactive: true,
			label: _('Active list'),
			style_class: 'todo-tab-button'
		});

		this.tabArchiveButton = new St.Button({
			name: 'tabArchiveButton',
			width: 125,
			height: 35,
			reactive: true,
			style_class: 'todo-tab-button',
			label: _('Recycle Bin')
		});

		this.tabActiveButton.connect('clicked', this._handleTabState.bind(this));
		this.tabArchiveButton.connect('clicked', this._handleTabState.bind(this));

		this.tabsBox.add_child(this.tabActiveButton);
		this.tabsBox.add_child(this.tabArchiveButton);

		this.todosScrollBox = new St.BoxLayout({
			style_class: 'todo-todos-scroll-box',
			vertical: true,
			x_expand: true,
			y_expand: true
		});

		this.scrollView = new St.ScrollView({
			style_class: 'todo-scroll-view',
			x_fill:true,
			y_fill: true,
            y_align: St.Align.START,
            overlay_scrollbars: true
		});
		this.scrollView.set_clip_to_allocation(true);

		this.todosBox = new St.BoxLayout({
			style_class: 'todo-todos-box',
			vertical: true
		});

		this.scrollView.add_actor(this.todosBox);
		this.todosScrollBox.add_child(this.scrollView);

		this.mainBox.add_child(this.topBox);
		this.mainBox.add_child(this.tabsBox);
		this.mainBox.add_child(this.todosScrollBox);

        this._menuItem = new PopupMenu.PopupBaseMenuItem({
			reactive: true,
            activate: false,
            hover: false,
            style_class: 'todo-popup-menu'
		});

        this._menuItem.add_child(this.mainBox);
		this._menuItem.connect('button-press-event', (actor) => {
			actor.grab_key_focus();
		});

        this.menu.addMenuItem(this._menuItem);
		this.menu.connect('open-state-changed', this._handleMenuState.bind(this));
		this.menu.connect('key-press-event', this._onMenuKeyPress.bind(this));
	}

	_onMenuKeyPress(actor, event) {
        let key = event.get_key_unicode();

		if (key.length != 0) {
			if (this.menu.isOpen) {
				this.clutterTaskEntry.grab_key_focus();
				let newText = this.clutterTaskEntry.get_text() + key;
				this.clutterTaskEntry.set_text(newText);
			}
		}
	}

	_handleMenuState() {
		if (this.menu.isOpen) {
			let currentActiveTab = this._getAvailableTasksCount() ? this.tabActiveButton : this.tabArchiveButton;
			this._handleTabState(currentActiveTab);
		}
	}

	_handleTabState(actor, shouldRefresh = true) {
		this._menuItem.grab_key_focus();
		if (!actor.has_style_class_name('todo-tab-button--active')) {
			let siblings = actor.get_parent().get_children();
			siblings.forEach((item, i) => {
				item.remove_style_class_name('todo-tab-button--active');
				item.set_opacity(170);
			});
			actor.add_style_class_name('todo-tab-button--active');
			actor.set_opacity(255);
			this.trashMode = actor.get_name() === 'tabArchiveButton';

			if (shouldRefresh) this.onRefresh();
		};
	}

	_addTask(title) {
		let text = title.trim();
		if (!text) return;

		log('TODO: Create new task');

		let newTask = {
			id: `${Utils.generateHash()}`,
			title: text,
			description: text,
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

	onRefresh(file, otherFile, eventType) {
		const { DELETED, CREATED, CHANGES_DONE_HINT } = Gio.FileMonitorEvent;

		if (eventType === undefined || eventType === CHANGES_DONE_HINT) {
			log('TODO: Remove the listeners. Refresh UI');
			this.todosBox.destroy_all_children(); // destroy all children and disconnect their listeners
			this._indicatorText.hide();
			this.tabsBox.hide();

			if (todoFileList.length) {
				log('TODO: Add the listeners...');
				this.tabsBox.show();
				this._activeTasksCount = this._getActiveTasksCount();
				this._notArchivedTasksCount = this._getAvailableTasksCount();

				if (this._notArchivedTasksCount) {
					this._indicatorText.show();
				}

				todoFileList
					.filter((item) => this.trashMode === item.isArchived)
					.forEach((item, i) => {
					let taskItem = new St.BoxLayout({
						reactive: true,
						style_class: 'todo-task-item'
					});

					let taskText = new St.Label({
						text: item.title,
						x_expand: true,
						reactive: true,
						track_hover: true,
						y_align: Clutter.ActorAlign.CENTER,
						opacity: item.isDone ? 130 : 255,
						style_class: `todo-tasktext ${item.isDone ? 'todo-tasktext--done' : ''}`,
						style: 'font-size: 15px;'
					});

					taskText.clutter_text.set_reactive(true);
					taskText.clutter_text.set_activatable(true);
					taskText.clutter_text.set_selectable(false);

					taskText.clutter_text.connect('enter-event', (actor) => {
						if (!actor.editable) {
							actor.set_line_wrap(true);
						}
					});
					taskText.clutter_text.connect('leave-event', (actor) => {
						if (!actor.editable) {
							actor.set_line_wrap(false);
						}
					});

					taskText.clutter_text.connect('activate', (actor) => {
						let text = actor.get_text().trim();
						if (!text) return;

						log('TODO: Update task');
						item.title = text;
						ControllerInstance.syncTodoData(todoFileList);
					});

					taskText.clutter_text.connect('button-press-event', (actor, e) => {
						if (e.get_click_count() !== 2) return;
						if (item.isDone || item.isArchived || item.editable) return;
						taskText.add_style_class_name('todo-tasktext--editing');
						actor.set_editable(true);
						actor.set_line_wrap(false);
					});

					taskText.clutter_text.connect('key-focus-out', (actor) => {
						taskText.remove_style_class_name('todo-tasktext--editing');
						actor.set_editable(false);
						actor.set_line_wrap(false);
						actor.set_text(item.title);
					});

					this.checkButton = new St.Icon({
						reactive: true,
						y_align: Clutter.ActorAlign.START,
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
						y_align: Clutter.ActorAlign.START,
			            gicon: new Gio.ThemedIcon({
							name: 'edit-clear-all-symbolic'
						}),
						icon_size: 16,
						track_hover: true,
						style_class: 'todo-delete-button'
			        });

					this.archiveButton = new St.Icon({
						reactive: true,
						y_align: Clutter.ActorAlign.START,
			            gicon: new Gio.ThemedIcon({
							name: 'user-trash-symbolic'
						}),
						icon_size: 16,
						track_hover: true,
						style_class: 'todo-archive-button'
			        });

					this.restoreButton = new St.Icon({
						reactive: true,
						y_align: Clutter.ActorAlign.START,
			            gicon: new Gio.ThemedIcon({
							name: 'edit-undo-symbolic'
						}),
						icon_size: 16,
						visible: false,
						track_hover: true,
						style_class: 'todo-restore-button'
			        });

					this.checkButton.connect('button-release-event', () => this._toggleTaskState(item));

					taskItem.add_child(this.checkButton);
					taskItem.add_child(taskText);

					if (this.trashMode) {
						this.restoreButton.connect('button-release-event', () => this._restoreTask(item));
						this.deleteButton.connect('button-release-event', () => this._removeTask(item));
						taskItem.add_child(this.restoreButton);
						taskItem.add_child(this.deleteButton);
						taskItem.connect('enter-event', (actor) => actor.get_child_at_index(2).show());
						taskItem.connect('leave-event', (actor) => actor.get_child_at_index(2).hide());
					} else {
						this.archiveButton.connect('button-release-event', () => this._archiveTask(item));
						taskItem.add_child(this.archiveButton);
					}

					this.todosBox.add_child(taskItem);
				});

				this._indicatorText.set_text(this._activeTasksCount
					? `( ${this._activeTasksCount} / ${this._notArchivedTasksCount} )`
					: 'All done'
				);
			}
		}
	}

	start() {
		ControllerInstance.enableTodoFileMonitor(this.onRefresh.bind(this));
	}

	stop() {
		log('TODO: Remove listeners...');
		this.menu.box.destroy_all_children();
		ControllerInstance.disableTodoFileMonitor();
	}
});

//------------------------------------------------------------------------------

function init(metadata) {
	log('TODO: INIT...');
	meta = metadata;
}

function enable() {
	log('TODO: START...');
	todoApp = new TodoApp();
	Main.panel.addToStatusArea('todoApp', todoApp);
}

function disable() {
	log('TODO: STOP...');
	todoApp.stop();
	log('TODO: DESTROY');
	todoApp.destroy();
	todoApp = null;
}
