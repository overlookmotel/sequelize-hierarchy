// --------------------
// Sequelize hierarchy
// Patched versions of sequelize methods which unify interface across Sequlize versions 2.x.x and 3.x.x
// --------------------

// modules
var semverSelect = require('semver-select');

var sequelizeVersionImported = require('sequelize/package.json').version;

// exports

// function to define patches
module.exports = function(Sequelize) {
    // get Sequelize version
    var sequelizeVersion = Sequelize.version || sequelizeVersionImported;

    // define patches
    return semverSelect.object(sequelizeVersion, {
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
        },
        truncate: {
            // workaround for bug in sequelize v2 with `truncate` option on models with schemas
            '^2.0.0': function(model, options) {
                if (model.sequelize.options.dialect == 'postgres' && model.options.schema) {
                    options.where = {};
                } else {
                    options.truncate = true;
                }
                return model.destroy(options);
            },
            '*': function(model, options) {
                options.truncate = true;
                return model.destroy(options);
            }
        }
    });
};
