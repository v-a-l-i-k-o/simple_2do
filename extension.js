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

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Controller = Extension.imports.controller;
const Convenience = Extension.imports.convenience;

let todoAppController;

function init(metadata) {
	log('TODO: INIT...');
	Convenience.initTranslations();
}

function enable() {
	log('TODO: START...');
	todoAppController = new Controller.TodoAppController();
	todoAppController.init();
}

function disable() {
	log('TODO: STOP...');
	todoAppController.stop();
	log('TODO: DESTROY');
	todoAppController.destroy();
	todoAppController = null;
}
