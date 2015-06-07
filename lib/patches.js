// --------------------
// Sequelize hierarchy
// Patched versions of sequelize methods which unify interface across Sequlize versions 2.x.x and 3.x.x
// --------------------

// modules
var semverSelect = require('semver-select');

var sequelizeVersion = require('sequelize/package.json').version;

// exports

// define patches
module.exports = semverSelect.object(sequelizeVersion, {
    query: {
        '^2.0.0': function(sequelize, sql, options) {
            return sequelize.query(sql, null, options);
        },
        '*': function(sequelize, sql, options) {
            return sequelize.query(sql, options);
        }
    },
    find: {
        '^2.0.0': function(model, options) {
            return model.find(options, {transaction: options.transaction, logging: options.logging});
        },
        '*': function(model, options) {
            return model.find(options);
        }
    },
    findAll: {
        '^2.0.0': function(model, options) {
            return model.findAll(options, {transaction: options.transaction, logging: options.logging});
        },
        '*': function(model, options) {
            return model.findAll(options);
        }
    }
});
