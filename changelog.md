# Changelog

## 0.0.1

* Initial release

## 0.0.2

* Implemented with hooks

## 0.0.3

* Removed unused dependency sequelize-transaction-promises
* Check for illegal parent ID in updates
* `Model#rebuildHierarchy()` function
* Bug fix for defining through table
* Hooks for `Model.find()` and `Model.findAll()` to convert flat representations of hierarchies into tree structures

## 0.0.4

* Transactionalised if operations to alter tables are called within a transaction
* Do not pass results back from hooks (not needed by Sequelize)
* Replaced usage of Promise.resolve().then() with Promise.try()
* Changed uses of Utils._.str.capitalize() to Utils.uppercaseFirst() to reflect removal of underscore.string dependency from sequelize
* Adjusted capitalization to reflect that model names and tables names are no longer capitalized
* Changed 'childs' to 'children' as pluralization now performed through Inflection library which pluralizes "child" correctly

## 0.0.5

First working version ready for use

* bulkCreate and bulkUpdate use hooks instead of shimming
* Dependency on shimming module removed
* Added tests for main functions
* Bug fixes

## 0.0.6

* `Model#find()` hooks made universal to allow e.g. `Person.findAll({ include: { model: Department, include: { model: Department, as: 'descendents', hierarchy: true } } })`
* Tests for find and accessors (`Model#getDescendents()` etc)

## 0.1.0

* Bug fix for `Model#rebuildHierarchy()`
* Tests for `Model#rebuildHierarchy()`
* Re-write of README file
* Bug fix for `Instance#setParent()`
* Prevent access to descendents & ancestors setters (e.g. `setAncestors`)
* Tests for accessors and setters

## 0.1.1

* Add keywords to package.json for NPM searching
* Move changelog into changelog.md

## 0.1.2

* Correct changelog formatting

## 0.1.3

* Allow hierarchy creation in `define()` options

## 0.1.4

* Cody tidy
* Added license

## 0.2.0

Now supports all Sequelize dialects.

* Postgres and SQLlite dialect support
* No need to provide Sequelize to main function. i.e. `var Sequelize = require('sequelize-hierarchy')();`
* Custom errors, inheriting from Sequelize.Error
* `camelThrough` and `freezeTableName` options
* Labels on created fields if `options.labels` = `true`
* Options to add attributes to `parentId` and `hierarchyLevel` fields
* Through model name created in singular rather than plural
* More support for underscored attribute naming style
* Default hierarchyLevel type is Sequelize.INTEGER for Postgres (Postgres does not support UNSIGNED)
* Moved `replaceIdentifiers()` function into separate `utils` file
* Set versions for mocha & chai dependencies
* JSHint included in tests
* Travis integration
* Travis loads sequelize dependency from Github repo master branch not npm
* Tests db user sequelize_test
* Travis uses db user travis
* Updated README with options documentation

## 0.2.1

* Bug fix: error on empty result set from `find()`
* Additional test for hierarchy model included 2 deep
* Update db library dependencies in line with Sequelize
* Amend travis config file to use `npm install` to install Sequelize's dependencies after getting latest master from git
* Typo in README

## 0.2.2

* Bug fix: `labels` option broken due to incorrect use of `this`
* Hierarchy options inherited from `sequelize.options` instead of `sequelize.options.define`
* `humanize()` utility function handles empty string/null/undefined
* Bug fix: Before find hook runs after `{ include: [ { all: ... } ] }` options expanded (previously wasn't)
* Added `editorconfig` file

## 0.2.3

* Bug fix: Deal with when an include is removed from results due to having `attributes: []` set in options on an include
* Performance gain where no hierarchies included in a find() query
* Specify to use latest Sequelize version from Github in package.json rather than .travis.yml

## 0.2.4

* Updated sequelize dependency to v2.0.0-rc3
* Correct error in README

## 0.2.5

* Lock sequelize dependency to 2.0.0-rc3 (errors with rc4)
* JSHint ignores redefinition of `Promise`

## 0.2.6

* Lock sequelize dev dependency to 2.0.0-rc3

## 0.2.7

* Remove `{raw: true}` option from queries for better compatibility with other plugins
* Model#rebuildHierarchy() utilizes transaction
* Remove all excess whitespace (no tabs on empty lines now)

## 0.2.8

* Fix bug in test with destroy options
* Set sequelize dependency to ~2.0.0-rc3 (tilde)
* Update db dev dependencies in line with Sequelize 2.0.0-rc8
* Update dev dependencies
* Travis runs on new container infrastructure

## 0.2.9

* Update sequelize dependency to v2.0.0+
* Update dev dependencies in line with sequelize v2.0.5
* Update test support files in line with sequelize v2.0.5
* Support for Microsoft SQL Server
* Remove use of deprecated sequelize API
* Workaround to run tests on SQLite
* Code tidy in test/support.js
* Tests always use options.camelThrough=true
* Travis runs tests against node 0.10 and 0.12
* Travis uses correct database users
* README code examples tagged as Javascript
* Correct typo in changelog

## 0.2.10

* Allow primaryKey customization (thanks @devlato)
* `make all` runs tests for Microsoft SQL Server
* README typo
