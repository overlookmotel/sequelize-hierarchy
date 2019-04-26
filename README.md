# sequelize-hierarchy.js

# Nested hierarchies for Sequelize

[![NPM version](https://img.shields.io/npm/v/sequelize-hierarchy.svg)](https://www.npmjs.com/package/sequelize-hierarchy)
[![Build Status](https://img.shields.io/travis/overlookmotel/sequelize-hierarchy/master.svg)](http://travis-ci.org/overlookmotel/sequelize-hierarchy)
[![Dependency Status](https://img.shields.io/david/overlookmotel/sequelize-hierarchy.svg)](https://david-dm.org/overlookmotel/sequelize-hierarchy)
[![Dev dependency Status](https://img.shields.io/david/dev/overlookmotel/sequelize-hierarchy.svg)](https://david-dm.org/overlookmotel/sequelize-hierarchy)
[![Greenkeeper badge](https://badges.greenkeeper.io/overlookmotel/sequelize-hierarchy.svg)](https://greenkeeper.io/)
[![Coverage Status](https://img.shields.io/coveralls/overlookmotel/sequelize-hierarchy/master.svg)](https://coveralls.io/r/overlookmotel/sequelize-hierarchy)

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

API is stable. All features and options are fairly well tested. Works with all dialects of SQL supported by Sequelize (MySQL, Postgres, SQLite) except for Microsoft SQL Server.

Requires Sequelize v2.x.x, v3.x.x, v4.x.x or v5.x.x. Supports only Node v8 or higher.

## Usage

### Loading module

To load module:

```js
const Sequelize = require('sequelize-hierarchy')();
// NB Sequelize must also be present in `node_modules`
```

or, a more verbose form useful if chaining multiple Sequelize plugins:

```js
const Sequelize = require('sequelize');
require('sequelize-hierarchy')(Sequelize);
```

### Initializing hierarchy

#### Model#isHierarchy( [options] )

```js
const sequelize = new Sequelize('database', 'user', 'password');

const Folder = sequelize.define('folder', { name: Sequelize.STRING });
Folder.isHierarchy();
```

`Folder.isHierarchy()` does the following:

* Adds a column `parentId` to Folder model
* Adds a column `hierarchyLevel` to Folder model (which should not be updated directly)
* Creates a new model `FolderAncestor` which contains the ancestry information (columns `folderId` and `ancestorId`)
* Creates the following associations (with foreign key constraints):
  * `Folder.belongsTo(Folder, {as: 'parent', foreignKey: 'parentId'})`
  * `Folder.hasMany(Folder, {as: 'children', foreignKey: 'parentId'})`
  * `Folder.belongsToMany(Folder, {as: 'descendents', foreignKey: 'ancestorId', through: FolderAncestor})`
  * `Folder.belongsToMany(Folder, {as: 'ancestors', foreignKey: 'folderId', through: FolderAncestor})`
* Creates hooks into standard Sequelize methods (create, update, destroy, bulkCreate etc) to automatically update the ancestry table and `hierarchyLevel` field as details in the folder table change
* Creates hooks into Sequelize's `Model#find()` and `Model#findAll()` methods so that hierarchies can be returned as javascript object tree structures

The column and table names etc can be modified by passing options to `.isHierarchy()`. See below for details.

#### via Sequelize#define() options

Hierarchies can also be created in `define()`:

```js
const Folder = sequelize.define('folder', {
  name: Sequelize.STRING
}, {
  hierarchy: true
});
```

or on an attribute in `define()`:

```js
const Folder = sequelize.define('folder', {
  name: Sequelize.STRING,
  parentId: {
    type: Sequelize.INTEGER,
    hierarchy: true
  }
});
```

If defining the hierarchy via model options, do not also call `.isHierarchy()`. The two methods are equivalent - only use one or the other.

#### Creating database tables

Defining the hierarchy sets up the *models* in Sequelize, not the database tables. You will need to create or modify the tables in the database.

If table already exists, add the following columns:

* `parentId` (same type as `id`)
* `hierarchyLevel` (`INTEGER` type)

If the table does not already exist, you can ask Sequelize to create it:

```js
await Folder.sync();
```

NB Call `.sync()` *after* `.isHierarchy()`.

The ancestry model (`FolderAncestor` in the above example) also needs its database table created:

```js
await sequelize.models.FolderAncestor.sync();
```

### Retrieving hierarchies

Examples of getting a hierarchy structure:

```js
// Get entire hierarchy as a flat list
const folders = await Folder.findAll();
// [
//   { id: 1, parentId: null, name: 'a' },
//   { id: 2, parentId: 1, name: 'ab' },
//   { id: 3, parentId: 2, name: 'abc' }
// ]

// Get entire hierarchy as a nested tree
const folders = await Folder.findAll({ hierarchy: true });
// [
//   { id: 1, parentId: null, name: 'a', children: [
//     { id: 2, parentId: 1, name: 'ab', children: [
//       { id: 3, parentId: 2, name: 'abc' }
//     ] }
//   ] }
// ]

// Get all the descendents of a particular item
const folder = await Folder.findOne({
  where: { name: 'a' },
  include: {
    model: Folder,
    as: 'descendents',
    hierarchy: true
  }
});
// { id: 1, parentId: null, name: 'a', children: [
//   { id: 2, parentId: 1, name: 'ab', children: [
//     { id: 3, parentId: 2, name: 'abc' }
//   ] }
// ] }

// Get all the ancestors (i.e. parent and parent's parent and so on)
const folder = await Folder.findOne({
  where: { name: 'abc' },
  include: [ { model: folder, as: 'ancestors' } ],
  order: [ [ { model: folder, as: 'ancestors' }, 'hierarchyLevel' ] ]
});
// { id: 3, parentId: 2, name: 'abc', ancestors: [
//   { id: 1, parentId: null, name: 'a' },
//   { id: 2, parentId: 1, name: 'ab' }
// ] }
```

The forms with `{ hierarchy: true }` are equivalent to using `Folder.findAll({ include: { model: Folder, as: 'children' } })` except that the include is recursed however deeply the tree structure goes.

### Accessors

Accessors are also supported:

```js
folder.getParent()
folder.getChildren()
folder.getAncestors()
folder.getDescendents()
```

Setters work as usual e.g. `folder.setParent()`, `folder.addChild()`.

### Options

The following options can be passed to `Model#isHierarchy( { /* options */ } )` or in a model definition:

```js
const Folder = sequelize.define('folder', {
  name: Sequelize.STRING
}, {
  hierarchy: { /* options */ }
});
```

Defaults are inherited from `sequelize.options.hierarchy` if defined in call to `new Sequelize()`.

Examples:

```js
Folder.isHierarchy( { as: 'above' } );

const Folder = sequelize.define('folder', {
  name: Sequelize.STRING
}, {
  hierarchy: { as: 'above' }
});
```

#### Aliases for relations

* `as`: Name of parent association. Defaults to `'parent'`.
* `childrenAs`: Name of children association. Defaults to `'children'`.
* `ancestorsAs`: Name of ancestors association. Defaults to `'ancestors'`.
* `descendentsAs`: Name of descendents association. Defaults to `'descendents'`.

These affect the naming of accessors e.g. `instance.getParent()`

#### Fields

* `levelFieldName`: Name of the hierarchy depth field. Defaults to `'hierarchyLevel'`.
* `levelFieldType`: Type of the hierarchy depth field. Defaults to `Sequelize.INTEGER.UNSIGNED`.
* `levelFieldAttributes`: Attributes to add to the hierarchy depth field. Defaults to `undefined`.
* `primaryKey`: Name of the primary key. Defaults to model's `primaryKeyAttribute`.
* `foreignKey`: Name of the parent field. Defaults to `'parentId'`.
* `foreignKeyAttributes`: Attributes to add to the parent field. Defaults to `undefined`.
* `throughKey`: Name of the instance field in hierarchy (through) table. Defaults to `'<model name>Id'`.
* `throughForeignKey`: Name of the ancestor field in hierarchy (through) table. Defaults to `'ancestorId'`.

#### Hierarchy (through) table

* `through`: Name of hierarchy (through) model. Defaults to `'<model name>ancestor'`.
* `throughTable`: Name of hierarchy (through) table. Defaults to `'<model name plural>ancestors'`.
* `throughSchema`: Schema of hierarchy (through) table. Defaults to `model.options.schema`, and is optional.
* `freezeTableName`: When `true`, through table name is same as through model name. Inherits from sequelize define options.
* `camelThrough`: When `true`, through model name and table name are camelized (i.e. `folderAncestor` not `folderancestor`). Inherits from sequelize define options.

All auto-created field names respect the setting of `model.options.underscored` and the through table name respects `sequelize.options.define.underscoredAll`.

#### Cascading deletions

* `onDelete`: Set to `'CASCADE'` if you want deleting a node to delete all its children.

#### Misc

* `labels`: When `true`, creates an attribute `label` on the created `parentId` and `hierarchyLevel` fields which is a human-readable version of the field name. Inherits from sequelize define options or `false`.

### Rebuilding the hierarchy
#### Model#rebuildHierarchy( [options] )

To build the hierarchy data on an existing table, or if hierarchy data gets corrupted in some way (e.g. by changes to parentId being made directly in the database not through Sequelize), you can rebuild it with:

```js
Folder.rebuildHierarchy()
```

NB: In normal circumstances, you should never need to use this method. It is only intended for the above two use cases.

### Bulk creation

You can use `.bulkCreate()` method in the usual way. Ensure that parents are created before their children.

### Errors

Errors thrown by the plugin are of type `HierarchyError`. The error class can be accessed at `Sequelize.HierarchyError`.

## Tests

Use `npm test` to run the tests. Use `npm run cover` to check coverage.

To run tests on a particular database, use `npm run test-mysql`, `npm run test-postgres`, `npm run test-postgres-native`, `npm run test-sqlite` or `npm run test-mssql`.

Requires a database called 'sequelize_test' and a db user 'sequelize_test' with no password.

## Changelog

See [changelog.md](https://github.com/overlookmotel/sequelize-hierarchy/blob/master/changelog.md)

## Issues

If you discover a bug, please raise an issue on Github. https://github.com/overlookmotel/sequelize-hierarchy/issues

## Contribution

Pull requests are very welcome. Please:

* ensure all tests pass before submitting PR
* do not add an entry to changelog - changelog will be created when cutting releases
* add tests for new features
* document new functionality/API additions in README
