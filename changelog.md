# Changelog

## 2.0.4

Bug fixes:

* `beforeBulkUpdate` hook run `beforeUpdate` hook on each item in series
* Only add `transaction` + `logging` options if defined

Tests:

* Add tests for defining models with `.init`
* Add tests for `onDelete: 'CASCADE'` option

Refactor:

* Use coroutines

Docs:

* `onDelete: 'CASCADE'` option
* Creating database tables

## 2.0.3

Bug fixes:

* `rebuildHierarchy` handles primary key not called `id`

## 2.0.2

Bug fixes:

* `beforeUpdate` hook get old `parentId` + `hierarchyLevel` if not known

Performance:

* Optimize `beforeUpdate` hook
* `afterFind` hook building hierarchy faster

Refactor:

* Major refactor for code style

Docs:

* Add Greenkeeper badge

## 2.0.1

Docs:

* README update

## 2.0.0

Breaking changes:

* Drop support for Node v4 + v6

Features:

* Support Sequelize v5

Docs:

* README update

Dev:

* Travis run tests on Node v10
* Replace JSHint with ESLint
* Rename `travis` npm script to `ci`
* Rename `jshint` npm script to `lint`
* Reorder dev dependencies
* Update `lodash` dependency
* Update dev dependencies
* Update Sequelize dev dependency to latest 4.x.x
* Update database library dev dependencies
* Travis CI install database libraries for Sequelize version
* Git ignore `package-lock.json`
* Git + npm ignore `npm-debug.log`
* npm ignore `.gitattributes`
* Fix typo in Changelog
* Reverse order of Changelog
* Update license year

Tests:

* Close sequelize connection at end to avoid hang
* Use async/await
* Fix linting errors

Refactor:

* Move entry point to `index.js`
* Fix linting errors
* Simplify error class definition
* Reduce indentation of `.then` blocks
* Replace `.forEach` with `for of`
* Remove unnecessary lodash calls
* Format code comments
* Add line spacing

## 1.3.2

* Fix: Bug introduced by removal of `Sequelize.Utils._` in Sequelize v4.11.0 (closes #142)

## 1.3.1

* Fix: Tests aimed at Sequelize v4 will also run on v5
* Fix: Tests create `drive` model in correct schema
* Tests drop all tables after each test
* Code style in tests

## 1.3.0

* Fix: Allow `underscored: false` option on model to override global option
* Fix: `rebuildHierarchy` support custom primary keys
* Run Travis CI on Node v8
* Update `sequelize` dev dependency to v4.3.2
* Update `lodash` dependency
* Update database library dev dependencies in line with Sequelize v4.3.2
* Update dev dependencies
* README update

## 1.2.0

* Fix: Support `underscored: true` and `underscoredAll: true` options (closes #18)

## 1.1.0

* Remove Sequelize peer dependency to fix Travis fails
* Added cross-env & swapped single for double quotes to support Windows (#81)

## 1.0.0

* Support only Node v4 upwards
* Fix: Semver version ranges for patches
* Refactor `lib/errors`
* Increase tests timeout to 30 seconds

## 0.8.0

* Support Sequelize v4.x.x
* Refactor `lib/modelExtends` to be a function returning an object
* Refactor `lib/errors` to be function not object
* Update `lodash` dependency
* Update dev dependencies
* Travis CI no tests for Node v0.10 + v0.12
* Travis CI no tests for MS SQL

## 0.7.7

* Skip Travis CI runs on release tags

## 0.7.6

* Fix: `beforeCreate` hook work with `options.fields`
* Fix: Clone `options.fields` before mutating it to prevent `options` object being mutated externally
* `.DS_Store` in `.gitignore`

## 0.7.5

* Fix: Support primary keys which are not called 'id'
* Fix: Support model fields with different table field names (closes #70)
* Refactor: Use `.slice()` to clone arrays
* Refactor `rebuildHierarchy()` for clarity

## 0.7.4

* Refactor nesting of children (more robust fix for #32)

## 0.7.3

* Tests `Support.clearDatabase()` clears all models in Sequelize v3.x
* Travis CI runs on all branches (to support greenkeeper.io)

## 0.7.2

* Fix: Wrong ordering of children (closes #32)
* Fix: When deleting instance attributes from `dataValues`, check is a Sequelize Model instance
* npm scripts for running tests on different databases
* README update

## 0.7.1

* Fix: `primaryKey` option (closes #67)
* Tidy npm scripts

## 0.7.0

* `throughSchema` option defaults to `model.options.schema` (closes #60)
* `update` throws error if item is its own parent (closes #23)
* `create` throws error if item is its own parent
* Throw specific error if try to create child of non-existent parent (closes #21)
* Run all tests with schemas (closes #59)
* Support sequelize's `fields` option
* Refactor
* Tests refactor
* Increase tests timeout for coveralls

Breaking changes:

* `throughSchema` option defaults to `model.options.schema`

## 0.6.0

* Schemas support (closes #46)
* Update `lodash` dependency
* Update database module dependencies in line with `sequelize` v3.23.3
* Update dev dependencies
* Only support node v0.10 upwards
* Remove testing on Travis for `mariadb` dialect
* Replace `Makefile` with npm scripts
* Travis tests node v4 + v6
* README update
* Update `.npmignore`
* Update license

## 0.5.8

* Add `throughSchema` option (#41)
* Tests for `through` options

## 0.5.7

* README update (for #31)

## 0.5.6

* README update (closes #31)
* Update `semver-select` dependency

## 0.5.5

* Re-enable test for scoped models

## 0.5.4

* MSSQL config for tests

## 0.5.3

* `find()` works with `hierarchy` and `raw` options (closes #9)

## 0.5.2

* Rename `SequelizeHierarchyError` to `HierarchyError` (closes #25)
* Documentation for errors (closes #19)

## 0.5.1

* Update dependency mysql in line with Sequelize v3.7.1
* Update dependency lodash
* Update dev dependencies
* Fix `getDescendents()` broken by changes in Sequelize v3.5.1
* Specific error when cannot construct hierarchy due to missing records
* Skip test for scoped models failing due to Sequelize bug (https://github.com/sequelize/sequelize/issues/4466)
* Patches use `Sequelize.version` for version number where available (closes #26)
* Code tidy

## 0.5.0

* Support for scopes

## 0.4.0

* Remove support for Microsoft SQL Server
* Bug fix: Delete removeAncestors and removeDescendents methods
* Bug fix: proper checking for undefined field labels
* Pass `options.logging` to all queries inside hooks
* Use semver-select module for patching Sequelize v2+v3
* Improved tests for thrown errors
* Test code coverage & Travis sends to coveralls

Breaking changes:

* Remove support for Microsoft SQL Server

## 0.3.1

* Update sqlite dev dependency in line with Sequelize v3.1.1

## 0.3.0

* Support for Sequelize v3.x.x
* Travis runs tests with Sequelize v3 and v2
* Disable Travis dependency cache
* Missing semicolons in tests
* Run jshint on tests
* Update README badges to use shields.io
* README TODOs

## 0.2.13

* Remove relative path to sequelize in tests

## 0.2.12

* Replace `utils.endsWith` with `_.endsWith`
* Tidy up changelog

## 0.2.11

* Loosen sequelize dependency version to v2.x.x
* Update mysql module dependency in line with sequelize v2.1.0
* Update lodash dependency
* Update dev dependencies
* README contribution section

## 0.2.10

* Allow primaryKey customization (thanks @devlato)
* `make all` runs tests for Microsoft SQL Server
* README typo

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

## 0.2.8

* Fix bug in test with destroy options
* Set sequelize dependency to ~2.0.0-rc3 (tilde)
* Update db dev dependencies in line with Sequelize 2.0.0-rc8
* Update dev dependencies
* Travis runs on new container infrastructure

## 0.2.7

* Remove `{raw: true}` option from queries for better compatibility with other plugins
* Model#rebuildHierarchy() utilizes transaction
* Remove all excess whitespace (no tabs on empty lines now)

## 0.2.6

* Lock sequelize dev dependency to 2.0.0-rc3

## 0.2.5

* Lock sequelize dependency to 2.0.0-rc3 (errors with rc4)
* JSHint ignores redefinition of `Promise`

## 0.2.4

* Updated sequelize dependency to v2.0.0-rc3
* Correct error in README

## 0.2.3

* Bug fix: Deal with when an include is removed from results due to having `attributes: []` set in options on an include
* Performance gain where no hierarchies included in a find() query
* Specify to use latest Sequelize version from Github in package.json rather than .travis.yml

## 0.2.2

* Bug fix: `labels` option broken due to incorrect use of `this`
* Hierarchy options inherited from `sequelize.options` instead of `sequelize.options.define`
* `humanize()` utility function handles empty string/null/undefined
* Bug fix: Before find hook runs after `{ include: [ { all: ... } ] }` options expanded (previously wasn't)
* Added `editorconfig` file

## 0.2.1

* Bug fix: error on empty result set from `find()`
* Additional test for hierarchy model included 2 deep
* Update db library dependencies in line with Sequelize
* Amend travis config file to use `npm install` to install Sequelize's dependencies after getting latest master from git
* Typo in README

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

## 0.1.4

* Cody tidy
* Added license

## 0.1.3

* Allow hierarchy creation in `define()` options

## 0.1.2

* Correct changelog formatting

## 0.1.1

* Add keywords to package.json for NPM searching
* Move changelog into changelog.md

## 0.1.0

* Bug fix for `Model#rebuildHierarchy()`
* Tests for `Model#rebuildHierarchy()`
* Re-write of README file
* Bug fix for `Instance#setParent()`
* Prevent access to descendents & ancestors setters (e.g. `setAncestors`)
* Tests for accessors and setters

## 0.0.6

* `Model#find()` hooks made universal to allow e.g. `Person.findAll({ include: { model: Department, include: { model: Department, as: 'descendents', hierarchy: true } } })`
* Tests for find and accessors (`Model#getDescendents()` etc)

## 0.0.5

First working version ready for use

* bulkCreate and bulkUpdate use hooks instead of shimming
* Dependency on shimming module removed
* Added tests for main functions
* Bug fixes

## 0.0.4

* Transactionalised if operations to alter tables are called within a transaction
* Do not pass results back from hooks (not needed by Sequelize)
* Replaced usage of Promise.resolve().then() with Promise.try()
* Changed uses of `Utils._.str.capitalize()` to `Utils.uppercaseFirst()` to reflect removal of underscore.string dependency from sequelize
* Adjusted capitalization to reflect that model names and tables names are no longer capitalized
* Changed 'childs' to 'children' as pluralization now performed through Inflection library which pluralizes "child" correctly

## 0.0.3

* Removed unused dependency sequelize-transaction-promises
* Check for illegal parent ID in updates
* `Model#rebuildHierarchy()` function
* Bug fix for defining through table
* Hooks for `Model.find()` and `Model.findAll()` to convert flat representations of hierarchies into tree structures

## 0.0.2

* Implemented with hooks

## 0.0.1

* Initial release
