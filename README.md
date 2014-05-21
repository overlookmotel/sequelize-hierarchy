# sequelize-hierarchy.js

Nested hierarchies for Sequelize

Under development. API is unstable. Not suitable for use quite yet.

Requires latest master 2.0.0-dev of Sequelize

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
* Creates hooks into standard sequelize methods (create, update and destroy etc) to automatically update the ancestry table as details in the folder table change

The column and table names etc can be modified by passing options to `.isHierarchy()`. See `modelExtends.js` in the code for details.

## Changelog

0.0.1

* Initial release

0.0.2

* Implemented with hooks

0.0.3

* Removed unused dependency on sequelize-transaction-promises
* Check for illegal parent ID in updates

## TODO

* Test function for bulkUpdate
* Add other creation methods (e.g. createChild, createParent etc)
* Work out why addChild is not working
* Check setParent accessor methods work
* Create more efficient function for bulkCreate (+ alter sequelize bulkCreate to do single multi-row insertion?)

## Known issues

* beforeUpdate hook function assumes that item has not been updated since it was originally retrieved from DB
* All hooks should be within transactions
