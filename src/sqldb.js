(function () {
	'use strict';

	const path = require('path'),
		fs = require('fs'),
		Promise = require('bluebird');

	const conf = require(path.join(require('app-root-path').toString(), 'src', 'config', 'config.js')).get(),
		dbconf =  require(path.join(require('app-root-path').toString(), 'src', 'config', 'dbconfig.js'));

	const bookshelf = dbconf.bookshelf;

	exports.Account = bookshelf.Model.extend({ tableName: 'accounts' });
	exports.Link = bookshelf.Model.extend({ tableName: 'links' });
	exports.Subreddit = bookshelf.Model.extend({ tableName: 'subreddits' });

	const createTable = (table) => {
		table.increments();
		table.string('name');
		table.integer('times_indexed');

		table.unique('name');
	};

	exports.checkCreateDb = () => {
		try {
			// DB exists
			return Promise.resolve(fs.accessSync(dbconf.dbPath, fs.constants.R_OK | fs.constants.W_OK));
		} catch (err) {
			// Make'a the new DB!
			// TODO This might blow up existing fucked up dbs; fix it later
			if (conf.debug) console.info('No database found; creating one at ' + exports.dbPath);

			return bookshelf.knex.schema.createTable('accounts', createTable)
				.then(() => {
					return bookshelf.knex.schema.createTable('links', createTable);
				})
				.then(() => {
					return bookshelf.knex.schema.createTable('subreddits', createTable);
				});
		}
	};

	async function incrementAndSave(obj) {
		if (obj) {
			obj.set('times_indexed', obj.get('times_indexed') + 1.0);
			return obj.save();
		}
	}

	exports.addAccount = async function (account, newIndex, increment) {
		if (account === '[deleted]' || account === 'automoderator') return Promise.resolve();

		return new exports.Account()
			.where({ name: account })
			.fetch()
			.then((x) => {
				if (!x) {
					if (conf.verbose) console.log("[+SQL] Account " + account);

					return new exports.Account({ name: account, times_indexed: newIndex })
						.save()
						.then((x) => x)
						.catch(() => null);
				} else if (increment) return incrementAndSave(x);
			});
	};

	exports.addSubreddit = async function (subreddit, newIndex, increment) {
		return new exports.Subreddit()
			.where({ name: subreddit })
			.fetch()
			.then((x) => {
				if (!x) {
					if (conf.verbose) console.log("[+SQL] Subreddit " + subreddit);

					return new exports.Subreddit({ name: subreddit, times_indexed: newIndex })
						.save()
						.then((x) => x)
						.catch(() => null);
				} else if (increment) return incrementAndSave(x);
			});
	};

	exports.addLink = async function (link, newIndex, increment) {
		return new exports.Link()
			.where({ name: link })
			.fetch()
			.then((x) => {
				if (!x) {
					if (conf.verbose) console.log("[+SQL] Link " + link);

					return new exports.Link({ name: link, times_indexed: newIndex })
						.save()
						.then((x) => x)
						.catch(() => null);
				} else if (increment) return incrementAndSave(x);
			});
	};

	exports.getIndexableAccounts = async function (limit) {
		return new exports.Account()
			.orderBy('times_indexed', 'asc')
			.fetchPage({
				page: 1,
				pageSize: limit
			});
	};

	exports.getIndexableSubreddits = async function (limit) {
		return new exports.Subreddit()
			.orderBy('times_indexed', 'asc')
			.fetchPage({
				page: 1,
				pageSize: limit
			});
	};

	exports.getIndexableLinks = async function (limit) {
		return new exports.Link()
			.orderBy('times_indexed', 'asc')
			.fetchPage({
				page: 1,
				pageSize: limit
			});
	};

	exports.getLinkSample = async function (limit) {
		return new exports.Link()
			.query((qb) => qb.orderByRaw('random()'))
			.fetchPage({
				page: 1,
				pageSize: limit
			})
			.then((res) => res.map((r) => r.get('name')));
	};

	exports.getLinkSampleInSubreddit = async function (subreddit, limit) {
		return new exports.Link()
			.query((qb) => {
				qb.whereRaw("name like '%/r/" + subreddit + "/%'");
				qb.orderByRaw('random()');
			})
			.fetchPage({
				page: 1,
				pageSize: limit
			})
			.then((res) => res.map((r) => {
				return r.get('name');
			}));
	};
})();