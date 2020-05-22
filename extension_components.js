 /* Simple 2Do - A simple TODO extension for GNOME 3.
  *
  * This program is free software: you can redistribute it and/or modify
  * it under the terms of the GNU General Public License as published by
  * the Free Software Foundation, either version 3 of the License, or
  * (at your option) any later version.
  *
  * This program is distributed in the hope that it will be useful,
  * but WITHOUT ANY WARRANTY; without even the implied warranty of
  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  * GNU General Public License for more details.
  *
  * You should have received a copy of the GNU General Public License
  * along with this program.  If not, see <http://www.gnu.org/licenses/>.
  */

const { St, GLib, Gio, GObject, Clutter } = imports.gi;
const {
	panelMenu: PanelMenu,
	popupMenu: PopupMenu
} = imports.ui;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext;
const _ = Gettext.domain(Extension.metadata['gettext-domain']).gettext;
const Constants = Extension.imports.constants;
const Helpers = Extension.imports.helpers;
const Utils = Extension.imports.utils;

//------------------------------------------------------------------------------

var TodoApp = GObject.registerClass({
	Signals: {
        'on-todo-file-changed': {}
    }
}, class Todo_PanelMenuButton extends PanelMenu.Button {
	_init(settings) {
		super._init(0.0, 'Simple 2Do', false);

		this._settings = settings;
		this._trashMode = false;
		this.todoFile = this._getTodoFile();
		this._activeTasksCount = this._getActiveTasksCount();
		this._availableTasksCount = this._getAvailableTasksCount();

		this._addPanelIndicator();
		this._addPopupMenu();
		this.refreshTodoList();
	}

	_getTodoFile() {
		log('TODO: Get todoFile from home directory');
		let [ok, contents] = GLib.file_get_contents(Constants.TODO_FILE_PATH);
		if (!ok) {
			throw new Error(`TODO: Something wrong with todoFile. Check: ${Constants.TODO_FILE_PATH}`);
		}
		let dataString = Helpers.stringFromUTF8Array(contents);
		log('TODO: Parse todoFile string');

		return JSON.parse(dataString);
	}

	_getActiveTasksCount() {
		return this.todoFile.filter(item => item && !item.isDone && !item.isArchived).length;
	}

	_getAvailableTasksCount() {
		return this.todoFile.filter(item => item && !item.isArchived).length;
	}

	_addPanelIndicator() {
		log('TODO: Build panel indicator');
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
			style_class: 'todo-indicator-text'
		});

		panelIndicator.add_child(indicatorIcon);
		panelIndicator.add_child(this._indicatorText);
		this.add_child(panelIndicator);
	}

	_addPopupMenu() {
		log('TODO: Build popup menu');
		let fontSize = this._settings.get_int('todo-font-size');
		this._mainBox = new St.BoxLayout({
			vertical: true,
			x_expand: true,
			style_class: 'todo-main-box',
			style: `font-size: ${fontSize}px;`
		});

		this._topBox = new St.BoxLayout({
			style_class: 'todo-top-box',
			vertical: true
		});

		this._taskEntry = new St.Entry({
			name: 'todoEntry',
			style_class: 'todo-entry',
			hint_text: _('Things needs to be done...'),
            can_focus: true,
			reactive: true,
			x_expand: true
		});

		this._clutterTaskEntry = this._taskEntry.get_clutter_text();
        this._clutterTaskEntry.connect('key-press-event', (actor, e) => {
			let symbol = e.get_key_symbol();
			if (
				symbol == Constants.KEY_RETURN ||
				symbol == Constants.KEY_ENTER
			) {
				this._addTask(actor.get_text());
				actor.set_text('');
				this._taskEntry.set_hint_text(_('Things needs to be done...'));
				this._onHandleTabState(this._tabActiveButton, false);
			}
		});

		this._topBox.add_child(this._taskEntry);

		this._tabsBox = new St.BoxLayout({
			style_class: 'todo-tabs-box',
			x_expand: true,
			y_align: Clutter.ActorAlign.CENTER,
			x_align: Clutter.ActorAlign.CENTER,
			vertical: false
		});

		this._tabActiveButton = this._createTabButton('tabActiveButton', 'Active list');
		this._tabArchiveButton = this._createTabButton('tabArchiveButton', 'Recycle Bin');

		this._tabActiveButton.connect('clicked', this._onHandleTabState.bind(this));
		this._tabArchiveButton.connect('clicked', this._onHandleTabState.bind(this));

		this._tabsBox.add_child(this._tabActiveButton);
		this._tabsBox.add_child(this._tabArchiveButton);

		this._todosScrollBox = new St.BoxLayout({
			style_class: 'todo-todos-scroll-box',
			vertical: true,
			x_expand: true,
			y_expand: true
		});

		this._scrollView = new St.ScrollView({
			style_class: 'todo-scroll-view',
			x_fill:true,
			y_fill: true,
            y_align: St.Align.START,
            overlay_scrollbars: true
		});
		this._scrollView.set_clip_to_allocation(true);

		this._todosBox = new St.BoxLayout({
			style_class: 'todo-todos-box',
			vertical: true
		});

		this._scrollView.add_actor(this._todosBox);
		this._todosScrollBox.add_child(this._scrollView);

		this._mainBox.add_child(this._topBox);
		this._mainBox.add_child(this._tabsBox);
		this._mainBox.add_child(this._todosScrollBox);

        this._menuItem = new PopupMenu.PopupBaseMenuItem({
			reactive: true,
            activate: false,
            hover: false,
            style_class: 'todo-popup-menu'
		});

        this._menuItem.add_child(this._mainBox);
		this._menuItem.connect('button-press-event', (actor) => {
			actor.grab_key_focus();
		});
		this._menuItem.connect('key-press-event', this._onKeyPressMenuItem.bind(this));

        this.menu.addMenuItem(this._menuItem);
		this.menu.connect('open-state-changed', this._onHandleMenuState.bind(this));
	}

	_createTabButton(name, label) {
		const button = new St.Button({
			name: name,
			label: _(label),
			width: 125,
			height: 35,
			reactive: true,
			style_class: 'todo-tab-button'
		});

		return button;
	}

	_createActionButton(symbolicName, className) {
		const button = new St.Icon({
			reactive: true,
			y_align: Clutter.ActorAlign.START,
			gicon: new Gio.ThemedIcon({
				name: symbolicName
			}),
			icon_size: 16,
			track_hover: true,
			style_class: `todo-action-button todo-action-button--${className}`
		});

		return button;
	}

	_onKeyPressMenuItem(actor, event) {
        const key = event.get_key_unicode();

		if (key.length != 0) {
			if (this.menu.isOpen) {
				this._clutterTaskEntry.grab_key_focus();
				let newText = this._clutterTaskEntry.get_text() + key;
				this._clutterTaskEntry.set_text(newText);
			}
		}
	}

	_onHandleMenuState() {
		if (this.menu.isOpen) {
			let currentActiveTab = this._getAvailableTasksCount() ? this._tabActiveButton : this._tabArchiveButton;
			this._onHandleTabState(currentActiveTab);
		}
	}

	_onHandleTabState(actor, shouldRefresh = true) {
		this._menuItem.grab_key_focus();
		if (!actor.has_style_class_name('todo-tab-button--active')) {
			let siblings = actor.get_parent().get_children();
			siblings.forEach((item, i) => {
				item.remove_style_class_name('todo-tab-button--active');
				item.set_opacity(170);
			});
			actor.add_style_class_name('todo-tab-button--active');
			actor.set_opacity(255);
			this._trashMode = actor.get_name() === 'tabArchiveButton';

			if (shouldRefresh) this.refreshTodoList();
		};
	}

	_addTask(title) {
		let text = title.trim();
		if (!text) return;

		log('TODO: Create new task');

		let newTask = {
			id: `${Utils.generateHash()}`,
			title: text,
			description: '',
			isDone: false,
			isArchived: false
		}

		this.todoFile.push(newTask);
		this.emit('on-todo-file-changed');
	}

	_onToggleTaskState(task) {
		if (this._trashMode) return;
		log('TODO: Switch tasks DONE param');
		this.todoFile.find(({ id }) => id === task.id).isDone = !task.isDone;
		this.emit('on-todo-file-changed');
	}

	_onArchiveTask(task) {
		log('TODO: Archive task');
		this.todoFile.find(({ id }) => id === task.id).isArchived = true;
		this.emit('on-todo-file-changed');
	}

	_onRestoreTask(task) {
		log('TODO: Restore task');
		this.todoFile.find(({ id }) => id === task.id).isArchived = false;
		this.emit('on-todo-file-changed');
	}

	_onRemoveTask(task) {
		log('TODO: Remove task');
		this.todoFile.splice(this.todoFile.indexOf(task), 1);
		this.emit('on-todo-file-changed');
	}

	refreshTodoList(file, otherFile, eventType) {
		const { DELETED, CREATED, CHANGES_DONE_HINT } = Gio.FileMonitorEvent;

		if (eventType === undefined || eventType === CHANGES_DONE_HINT) {
			log('TODO: Refresh ToDo list');
			// destroy all children and disconnect their listeners
			this._todosBox.destroy_all_children();
			this._indicatorText.hide();
			this._tabsBox.hide();

			if (this.todoFile.length) {
				let taskHeight;
				let tasksAmountToDisplay = this._settings.get_int('todo-tasks-amount');
				this._tabsBox.show();
				this._activeTasksCount = this._getActiveTasksCount();
				this._availableTasksCount = this._getAvailableTasksCount();

				if (this._availableTasksCount) {
					this._indicatorText.show();
				}

				this.todoFile
					.filter((item) => this._trashMode === item.isArchived)
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
						style_class: `todo-tasktext ${item.isDone ? 'todo-tasktext--done' : ''}`
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
						this.emit('on-todo-file-changed');
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

					this._checkButton = new St.Icon({
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

					this._deleteButton = this._createActionButton('edit-clear-all-symbolic', 'delete');
					this._archiveButton = this._createActionButton('user-trash-symbolic', 'archive');
					this._restoreButton = this._createActionButton('edit-undo-symbolic', 'restore');

					this._checkButton.connect('button-release-event', () => this._onToggleTaskState(item));

					taskItem.add_child(this._checkButton);
					taskItem.add_child(taskText);

					if (this._trashMode) {
						this._restoreButton.connect('button-release-event', () => this._onRestoreTask(item));
						this._deleteButton.connect('button-release-event', () => this._onRemoveTask(item));
						taskItem.add_child(this._restoreButton);
						taskItem.add_child(this._deleteButton);
						taskItem.connect('enter-event', (actor) => actor.get_child_at_index(2).show());
						taskItem.connect('leave-event', (actor) => actor.get_child_at_index(2).hide());
					} else {
						this._archiveButton.connect('button-release-event', () => this._onArchiveTask(item));
						taskItem.add_child(this._archiveButton);
					}

					this._todosBox.add_child(taskItem);
					if (!taskHeight) {
						taskHeight = taskItem.get_height();
					}
				});

				this._todosScrollBox.set_style(`max-height: ${taskHeight * tasksAmountToDisplay}px;`);

				this._indicatorText.set_text(this._activeTasksCount
					? `( ${this._activeTasksCount} / ${this._availableTasksCount} )`
					: _('All done')
				);
			}
		}
	}

	reloadApp() {
		this._menuItem.destroy();
		this._addPopupMenu();
		this.refreshTodoList();
	}
});
