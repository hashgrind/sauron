(function () {
	'use strict';

	const fs = require('fs'),
		path = require('path');

	const conf = require(path.join(require('app-root-path').toString(), 'src', 'config', 'config.js')).get();

	exports.dbPath = require('path').join(require('app-root-path').toString(),  'src', 'db', conf.dbName);

	exports.dbConfig = {
		client: 'sqlite3',
		connection: { filename: exports.dbPath },
		debug: conf.sqlDebug,
		useNullAsDefault: true // Needed for sqlite
	};

	exports.knex = require('knex')(exports.dbConfig);

	exports.bookshelf = require('bookshelf')(exports.knex);

	exports.bookshelf.plugin('pagination');
})();