# sequelize-hierarchy.js

Nested hierarchies for Sequelize

Under development. API is stable and works with MySQL. Testing and re-coding to work with other DB dialects supported by Sequelize (Postgres, SQLite etc) would be a welcome contribution.

Requires Sequelize v2.0.0-rc1 or later (when hooks on `Model#findAll()` were introduced).

## Usage

Example:

	var Sequelize = require('sequelize');
	require('sequelize-hierarchy')(Sequelize);
	
	var sequelize = new Sequelize('database', 'user', 'password');
	
	var folder = sequelize.define('folder', name: { type: Sequelize.STRING });
	folder.isHierarchy();

This does the following:

* Adds a column `parentId` to Folder model
* Adds a column `hierarchyLevel` to Folder model (which should not be updated directly)
* Creates a new table `foldersAncestors` which contains the ancestry information
* Creates hooks into standard Sequelize methods (create, update, destroy etc) to automatically update the ancestry table as details in the folder table change
* Creates hooks into Sequelize's `Model#find()` and `Model#findAll()` methods so that hierarchies can be returned as javascript object tree structures

The column and table names etc can be modified by passing options to `.isHierarchy()`. See `modelExtends.js` in the code for details.

Examples of getting a hierarchy structure:

	folder.findAll().then(function(results) {
		// results = [
		//	{ id: 1, parentId: null, name: 'a' },
		//	{ id: 2, parentId: 1, name: 'ab' },
		//	{ id: 3, parentId: 2, name: 'abc' }
		// ]
	})

	folder.findAll({ hierarchy: true }).then(function(results) {
		// results = [
		//	{ id: 1, parentId: null, name: 'a', children: [
		//		{ id: 2, parentId: 1, name: 'ab', children: [
		//			{ id: 3, parentId: 2, name: 'abc' }
		//		] }
		//	] }
		// ]
	})
	
	folder.find({ where: { id: 1 }, include: [ { model: folder, as: 'descendents', hierarchy: true } ] }).then(function(result) {
		// result =
		// { id: 1, parentId: null, name: 'a', children: [
		//		{ id: 2, parentId: 1, name: 'ab', children: [
		//			{ id: 3, parentId: 2, name: 'abc' }
		//		] }
		// ] }
	})

The forms with `{ hierarchy: true }` are equivalent to using `folder.findAll({ include: [ { model: folder, as: 'children' } ] })` except that the include is recursed however deeply the tree structure goes.

## Tests

Use `npm test` to run the tests.
Requires a database called 'sequelize_test' and a db user 'sequelize_test', password 'sequelize_test'.

## Changelog

0.0.1

* Initial release

0.0.2

* Implemented with hooks

0.0.3

* Removed unused dependency sequelize-transaction-promises
* Check for illegal parent ID in updates
* `Model#rebuildHierarchy()` function
* Bug fix for defining through table
* Hooks for `Model.find()` and `Model.findAll()` to convert flat representations of hierarchies into tree structures

0.0.4

* Transactionalised if operations to alter tables are called within a transaction
* Do not pass results back from hooks (not needed by Sequelize)
* Replaced usage of Promise.resolve().then() with Promise.try()
* Change uses of Utils._.str.capitalize() to Utils.uppercaseFirst() to reflect removal of underscore.string dependency from sequelize
* Adjusted capitalization to reflect that model names and tables names are no longer capitalized
* Changed 'childs' to 'children' as pluralization now performed through Inflection library which plururalizes "child" correctly

0.0.5 (First working version ready for use)

* bulkCreate and bulkUpdate use hooks instead of shimming
* Dependency on shimming module removed
* Added tests for main functions
* Bug fixes

## TODO

* Tests for other functions
* Check setParent etc accessor methods work
* Add other creation methods (e.g. createChild, createParent etc)
* Create more efficient function for bulkCreate (+ alter sequelize bulkCreate to do single multi-row insertion?)

## Known issues

* beforeUpdate hook function assumes that item has not been updated since it was originally retrieved from DB
* All hooks should be within transactions
