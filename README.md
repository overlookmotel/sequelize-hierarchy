# sequelize-hierarchy.js

Nested hierarchies for Sequelize

Under development. API is unstable. Not suitable for use quite yet.

Requires latest master 2.0.0-dev of Sequelize

## Changelog

0.0.1

* Initial release

0.0.2

* Implemented with hooks

0.0.3

* Removed unused dependency on sequelize-transaction-promises

## TODO

Test function for bulkUpdate
Add check for illegal parentId as update validate hook
Add other creation methods (e.g. createChild, createParent etc)
Work out why addChild is not working
Check setParent accessor methods work

Create more efficient function for bulkCreate (+ alter sequelize bulkCreate to do single multi-row insertion?)

## Known issues

beforeUpdate hook function assumes that item has not been updated since it was originally retrieved from DB
All hooks should be within transactions

