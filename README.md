# sequelize-hierarchy.js

Nested hierarchies for Sequelize

Under development. API is stable but not suitable for use quite yet.

Requires master recent v2.0.0-dev version of Sequelize. As of 24 May 2014, the necessary hooks in Sequelize are not yet present, awaiting a PR to be accepted.

## Usage

Example:

	var Sequelize = require('sequelize');
	require('sequelize-hierarchy')(Sequelize);
	
	var sequelize = new Sequelize('database', 'user', 'password');
	
	var Folder = sequelize.define('Folder', name: { type: Sequelize.STRING });
	Folder.isHierarchy();

This does the following:

* Adds a column `ParentId` to Folder model
* Adds a column `HierarchyLevel` to Folder model (which should not be updated directly)
* Creates a new table `FoldersAncestors` which contains the ancestry information
* Creates hooks into standard Sequelize methods (create, update and destroy etc) to automatically update the ancestry table as details in the folder table change
* Creates hooks into Sequelize's `find()` and `findAll()` methods so that hierarchies can be returned as javascript object tree structures 

The column and table names etc can be modified by passing options to `.isHierarchy()`. See `modelExtends.js` in the code for details.

Examples of getting a hierarchy structure:

	Folder.findAll().then(function(results) {
		// results = [
		//	{ id: 1, ParentId: null, name: 'a' },
		//	{ id: 2, ParentId: 1, name: 'ab' },
		//	{ id: 3, ParentId: 2, name: 'abc' }
		// ]
	})

	Folder.findAll({ hierarchy: true }).then(function(results) {
		// results = [
		//	{ id: 1, ParentId: null, name: 'a', childs: [
		//		{ id: 2, ParentId: 1, name: 'ab', childs: [
		//			{ id: 3, ParentId: 2, name: 'abc' }
		//		] }
		//	] }
		// ]
	})
	
	Folder.find({ where: { id: 1 }, include: [ { model: Folder, as: 'Descendents', hierarchy: true } ] }).then(function(result) {
		// result =
		// { id: 1, ParentId: null, name: 'a', childs: [
		//		{ id: 2, ParentId: 1, name: 'ab', childs: [
		//			{ id: 3, ParentId: 2, name: 'abc' }
		//		] }
		// ] }
	})

The forms with `{ hierarchy: true }` are equivalent to using `Folder.findAll({ include: [ { model: Folder, as: 'Childs' } ] })` except that the include is recursed however deeply the tree structure goes.

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

## TODO

* Add other creation methods (e.g. createChild, createParent etc)
* Check setParent etc accessor methods work
* Write tests
* Create more efficient function for bulkCreate (+ alter sequelize bulkCreate to do single multi-row insertion?)

## Known issues

* beforeUpdate hook function assumes that item has not been updated since it was originally retrieved from DB
* All hooks should be within transactions
