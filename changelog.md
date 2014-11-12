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
* Changed 'childs' to 'children' as pluralization now performed through Inflection library which plururalizes "child" correctly

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

## Next

* Bug fix: error on empty result set from `find()`
* Typo in README
