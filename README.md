# sequelize-hierarchy.js

# Nested hierarchies for Sequelize

## What's it for?

Relational databases aren't very good at dealing with nested hierarchies.

Examples of hierarchies are:

* Nested folders where each folder has many subfolders, those subfolders themselves have subfolders, and so on
* Categories and sub-categories e.g. for a newspaper with sections for different sports, Sports category splits into Track Sports and Water Sports, Water Sports into Swimming and Diving, Diving into High Board, Middle Board and Low Board etc
* Tree structures

To store a hierarchy in a database, the usual method is to give each record a ParentID field which says which is the record one level above it.

Fetching the parent or children of any record is easy, but if you want to retrieve an entire tree/hierarchy structure from the database, it requires multiple queries, recursively getting each level of the hierarchy. For a big tree structure, this is a lengthy process, and annoying to code.

This plugin for [Sequelize](http://sequelizejs.com/) solves this problem.

## Current status

[![Build Status](https://secure.travis-ci.org/overlookmotel/sequelize-hierarchy.png?branch=master)](http://travis-ci.org/overlookmotel/sequelize-hierarchy)
[![Dependency Status](https://david-dm.org/overlookmotel/sequelize-hierarchy.png)](https://david-dm.org/overlookmotel/sequelize-hierarchy)

API is stable. All features and options are fairly well tested. Works with all dialects of SQL supported by Sequelize (MySQL, Postgres, SQLite).

Requires Sequelize v2.0.0-rc3 or later.

## Usage

### Loading module

To load module:

	var Sequelize = require('sequelize-hierarchy')();
	// NB Sequelize must also be present in `node_modules`

or, a more verbose form useful if chaining multiple Sequelize plugins:

	var Sequelize = require('sequelize');
	require('sequelize-hierarchy')(Sequelize);

### Initializing hierarchy
#### Model#isHierarchy( [options] )

	var sequelize = new Sequelize('database', 'user', 'password');

	var folder = sequelize.define('folder', name: { type: Sequelize.STRING });
	folder.isHierarchy();

`folder.isHierarchy()` does the following:

* Adds a column `parentId` to Folder model
* Adds a column `hierarchyLevel` to Folder model (which should not be updated directly)
* Creates a new model `folderAncestor` which contains the ancestry information
* Creates hooks into standard Sequelize methods (create, update, destroy etc) to automatically update the ancestry table as details in the folder table change
* Creates hooks into Sequelize's `Model#find()` and `Model#findAll()` methods so that hierarchies can be returned as javascript object tree structures

The column and table names etc can be modified by passing options to `.isHierarchy()`. See below for details.

#### via Sequelize#define() options

Hierarchies can also be created in `define()`:

	var folder = sequelize.define('folder', { name: Sequelize.STRING }, { hierarchy: true });

or on an attribute in `define()`:

	var folder = sequelize.define('folder', {
		name: Sequelize.STRING,
		parentId: {
			type: Sequelize.INTEGER.UNSIGNED,
			hierarchy: true
		}
	});

### Retrieving hierarchies

Examples of getting a hierarchy structure:

	// get entire hierarchy as a flat list
	folder.findAll().then(function(results) {
		// results = [
		//	{ id: 1, parentId: null, name: 'a' },
		//	{ id: 2, parentId: 1, name: 'ab' },
		//	{ id: 3, parentId: 2, name: 'abc' }
		// ]
	})

	// get entire hierarchy as a nested tree
	folder.findAll({ hierarchy: true }).then(function(results) {
		// results = [
		//	{ id: 1, parentId: null, name: 'a', children: [
		//		{ id: 2, parentId: 1, name: 'ab', children: [
		//			{ id: 3, parentId: 2, name: 'abc' }
		//		] }
		//	] }
		// ]
	})

	// get all the descendents of a particular item
	folder.find({ where: { name: 'a' }, include: { model: folder, as: 'descendents', hierarchy: true } }).then(function(result) {
		// result =
		// { id: 1, parentId: null, name: 'a', children: [
		//		{ id: 2, parentId: 1, name: 'ab', children: [
		//			{ id: 3, parentId: 2, name: 'abc' }
		//		] }
		// ] }
	})

	// get all the ancestors (i.e. parent and parent's parent and so on)
	folder.find({
		where: { name: 'abc' },
		include: [ { model: folder, as: 'ancestors' } ],
		order: [ [ { model: folder, as: 'ancestors' }, 'hierarchyLevel' ] ]
	}).then(function(result) {
		// results = [
		//	{ id: 3, parentId: 2, name: 'abc', ancestors: [
		//		{ id: 1, parentId: null, name: 'a' },
		//		{ id: 2, parentId: 1, name: 'ab' }
		//	] }
		// ]
	})

The forms with `{ hierarchy: true }` are equivalent to using `folder.findAll({ include: { model: folder, as: 'children' } })` except that the include is recursed however deeply the tree structure goes.

### Accessors

Accessors are also supported:

	thisFolder.getParent()
	thisFolder.getChildren()
	thisFolder.getAncestors()
	thisFolder.getDescendents()

### Options

The following options can be passed to `Model#isHierarchy( options )`.
Defaults are inherited from `sequelize.options.hierarchy` if defined in call to `new Sequelize()`.

#### Aliases for relations

* `as`: Name of parent association. Defaults to `'parent'`
* `childrenAs`: Name of children association. Defaults to `'children'`
* `ancestorsAs`: Name of ancestors association. Defaults to `'ancestors'`
* `descendentsAs`: Name of descendents association. Defaults to `'descendents'`

These affect the naming of accessors e.g. `instance.getParent()`

#### Fields

* `levelFieldName`: Name of the hierarchy depth field. Defaults to `'hierarchyLevel'`
* `levelFieldType`: Type of the hierarchy depth field. Defaults to `Sequelize.INTEGER.UNSIGNED`
* `levelFieldAttributes`: Attributes to add to the hierarchy depth field. Defaults to `undefined`
* `foreignKey`: Name of the parent field. Defaults to `'parentId'`
* `foreignKeyAttributes`: Attributes to add to the parent field. Defaults to `undefined`
* `throughKey`: Name of the instance field in hierarchy (through) table. Defaults to `'<model name>Id'`
* `throughForeignKey`: Name of the ancestor field in hierarchy (through) table. Defaults to `'ancestorId'`

#### Hierarchy (through) table

* `through`: Name of hierarchy (through) model. Defaults to `'<model name>ancestor'`
* `throughTable`: Name of hierarchy (through) table. Defaults to `'<model name plural>ancestors'`

* `freezeTableName`: When `true`, through table name is same as through model name. Inherits from sequelize define options
* `camelThrough`: When `true`, through model name and table name are camelized (i.e. `folderAncestor` not `folderancestor`). Inherits from sequelize define options

#### Misc

* `labels`: When `true`, creates an attribute `label` on the created `parentId` and `hierarchyField` which is a human-readable version of the field name. Inherits from sequelize define options or `false`

### Rebuilding the hierarchy
#### Model#rebuildHierarchy( [options] )

To build the hierarchy data on an existing table, or if hierarchy data gets corrupted in some way (e.g. by changes to parentId being made directly in the database not through Sequelize), you can rebuild it with:

	folder.rebuildHierarchy()

## Tests

Use `npm test` to run the tests.
Requires a database called 'sequelize_test' and a db user 'sequelize_test' with no password.

## Changelog

See changelog.md

## TODO

* Create more efficient function for bulkCreate (+ alter sequelize bulkCreate to do single multi-row insertion?). Would not affect API or behaviour, just improve performance.

## Known issues

* beforeUpdate hook function assumes that item has not been updated since it was originally retrieved from DB
* All hooks should be within transactions

If you discover a bug, please raise an issue on Github. https://github.com/overlookmotel/sequelize-hierarchy/issues
