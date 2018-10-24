(function () {
	'use strict';

	const path = require('path'),
		rp = require('request-promise'),
		Promise = require('bluebird'),
		_ = require('lodash'),
		prompts = require('prompts');

	const conf = require(path.join(require('app-root-path').toString(), 'src', 'config', 'config.js')).get(),
		graphDb = require(path.join(require('app-root-path').toString(), 'src', 'graphdb.js')),
		sqlDb = require(path.join(require('app-root-path').toString(), 'src', 'sqldb.js'));

	async function get(url) {
		if (conf.debug) console.debug('GET ' + url);
		return rp(url)
			.then((bod) => {
				if (conf.debug) console.debug(bod);
				return JSON.parse(bod);
			})
			.catch(console.error);
	}

	async function getRedditObject(url) {
		return get(url)
			.then((obj) => {
				return obj;
			})
	}

	async function getRedditObjectData(url) {
		return getRedditObject(url)
			.then((obj) => {
				return obj.data;
			});
	}

	function isComment(obj) { return obj.kind === 't1'; }
	function isLink(obj) { return obj.kind === 't3'; }

	const ignoreUsers = ['[deleted]', 'automoderator'];

	exports.runCommand = async function (cmd, opts) {
		if (conf.debug) console.debug('Running', cmd, 'with', opts);

		switch (cmd) {
			case 'specific_user': {
				if (ignoreUsers.indexOf(opts.argument) > -1) return Promise.resolve();

				return getRedditObjectData('https://www.reddit.com/user/' + opts.argument + '/.json')
					.then((userData) => {
						let accountName = opts.argument.toLowerCase();

						return sqlDb.addAccount(accountName, 1, true)
							.then(graphDb.getOrCreateAccount(accountName))
							.then((accountNode) => {
								let promiseChain = [];

								_.forEach(userData.children, (child) => {
									let subredditName = child.data.subreddit.toLowerCase();

									if (isComment(child)) {
										promiseChain.push(
											sqlDb.addSubreddit(subredditName, 0, false)
												.then(graphDb.getOrCreateSubreddit(subredditName))
												.then((subredditNode) => {
													return graphDb.getOrCreateDirectedRelationship(accountName, 'Account', 'COMMENTED_IN', subredditName, 'Subreddit');
												})
										);
									} else if (isLink(child)) {
										let link = 'https://reddit.com' + child.data.permalink.toLowerCase();

										promiseChain.push(
											sqlDb.addLink(link, 0, false)
												.then(sqlDb.addSubreddit(subredditName, 0, false))
												.then(graphDb.getOrCreateSubreddit(subredditName))
												.then((subredditNode) => {
													return graphDb.getOrCreateDirectedRelationship(accountName, 'Account', 'POSTED_IN', subredditName, 'Subreddit');
												})
										);
									}
								});

								return Promise.each(promiseChain, (prom) => prom);
							});
					});
			}
			case 'specific_subreddit': {
				return getRedditObjectData('https://www.reddit.com/r/' + opts.argument + '/.json')
					.then((subredditData) => {
						let subredditName = opts.argument.toLowerCase();

						return sqlDb.addSubreddit(subredditName, 1, true)
							.then(graphDb.getOrCreateSubreddit(subredditName))
							.then((subredditNode) => {
								let promiseChain = [];

								_.forEach(subredditData.children, (child) => {
									let accountName = child.data.author.toLowerCase();

									if (isLink(child)) {
										let link = 'https://reddit.com' + child.data.permalink.toLowerCase();

										promiseChain.push(
											sqlDb.addLink(link, 0, false)
												.then(sqlDb.addAccount(accountName, 0, false))
												.then(graphDb.getOrCreateAccount(accountName))
												.then((accountNode) => {
													return graphDb.getOrCreateDirectedRelationship(accountName, 'Account', 'POSTED_IN', subredditName, 'Subreddit');
												}));
									}
								});

								return Promise.each(promiseChain, (prom) => prom);
							});
					});
			}
			case 'specific_link': {
				return getRedditObject(opts.argument + '.json')
					.then((linkData) => {
						let linkName = opts.argument.toLowerCase();

						return sqlDb.addLink(linkName, 1, true)
							.then(graphDb.getOrCreateAccount(linkData[0].data.children[0].data.author.toLowerCase()))
							.then(graphDb.getOrCreateSubreddit(linkData[0].data.children[0].data.subreddit.toLowerCase()))
							.then(() => {
								let promiseChain = [];

								_.forEach(linkData[1].data.children, (child) => {
									if (child) {
										if (isComment(child)) {
											let accountName = child.data.author.toLowerCase();
											let subredditName = child.data.subreddit.toLowerCase();

											promiseChain.push(
												graphDb.getOrCreateAccount(accountName)
													.then(graphDb.getOrCreateDirectedRelationship(accountName, 'Account', 'COMMENTED_IN', subredditName, 'Subreddit'))
											);
										}
									}
								});

								return Promise.each(promiseChain, (prom) => prom);
							});
					});
			}

			case 'grow': {
				let subOpts = null;
				if (opts && opts.subOpts) subOpts = opts.subOpts;
				if (!subOpts) subOpts = await prompts([
					{
						type: 'select',
						name: 'mode',
						message: 'What mode?',
						choices: [
							{ title: 'User Stalk', value: 'user_stalk' },
							{ title: 'Subreddit Stalk', value: 'subreddit_stalk' },
							{ title: 'Graph-Based Growth', value: 'graph_smart_grow' },
							{ title: 'Link-Based Growth', value: 'link_grow' },
							{ title: 'Curiosity-Based Growth', value: 'viagra' },
						]
					},
					{
						type: 'select',
						name: 'aggression',
						message: 'How aggressively?',
						choices: [
							{ title: 'Cautious', value: 'cautious' },
							{ title: 'YOLO', value: 'yolo' },
							{ title: 'Fuck It, We\'ll Do It Live', value: 'fuckit' }
						],
						initial: 2
					}
				]);

				let stalkCmds = null;
				if (opts && opts.which) stalkCmds = opts.which;
				if (!stalkCmds) if (subOpts.mode === 'user_stalk' || subOpts.mode === 'subreddit_stalk') stalkCmds = await prompts({
					type: 'text',
					name: 'which',
					message: 'Which?'
				});

				if (subOpts.mode === 'user_stalk') {
					let limit = 10;
					if (subOpts.aggression === 'yolo') limit = 50;
					else if (subOpts.aggression === 'fuckit') limit = 250;

					let promiseChain = [];

					graphDb.getSubredditsNearAccount(stalkCmds.which.toLowerCase(), limit)
						.then((res) => {
							_.forEach(res, (r) => {
								promiseChain.push(
									exports.runCommand('specific_subreddit', { argument: r.toLowerCase() })
								);
							});
						});

					return Promise.each(promiseChain, (prom) => prom);
				} else if (subOpts.mode === 'subreddit_stalk') {
					let limit = 10;
					if (subOpts.aggression === 'yolo') limit = 50;
					else if (subOpts.aggression === 'fuckit') limit = 250;

					let promiseChain = [];

					graphDb.getAccountsNearSubreddit(stalkCmds.which.toLowerCase(), limit)
						.then((res) => {
							_.forEach(res, (r) => {
								promiseChain.push(
									exports.runCommand('specific_user', { argument: r.toLowerCase() })
								);
							});
						})
						.then(() => {
							sqlDb.getLinkSampleInSubreddit(stalkCmds.which.toLowerCase(), limit)
								.then((res) => {
									_.forEach(res, (l) => {
										promiseChain.push(
											exports.runCommand('specific_link', { argument: l.toLowerCase() })
										);
									});
								});
						})
						.then(() => {
							graphDb.getSubredditsNearSubreddit(stalkCmds.which.toLowerCase(), limit)
								.then((res) => {
									_.forEach(res, (s) => {
										promiseChain.push(
											exports.runCommand('specific_subreddit', { argument: s.toLowerCase() })
										);
									});
								});
						});

					return Promise.each(promiseChain, (prom) => prom);
				} else if (subOpts.mode === 'viagra') {
					let limit = 1;
					if (subOpts.aggression === 'yolo') limit = 50;
					else if (subOpts.aggression === 'fuckit') limit = 100;

					let promiseChain = [];

					sqlDb.getIndexableAccounts(limit)
						.then((res) => {
							res.forEach((x) => {
								promiseChain.push(exports.runCommand('specific_user', { argument: x.get('name').toLowerCase() }));
							});
						})
						.then(() => {
							sqlDb.getIndexableSubreddits(limit)
								.then((res) => {
									res.forEach((x) => {
										promiseChain.push(exports.runCommand('specific_subreddit', { argument: x.get('name').toLowerCase() }));
									});
								});
						})
						.then(() => {
							sqlDb.getIndexableLinks(limit).then((res) => {
								res.forEach((x) => {
									promiseChain.push(exports.runCommand('specific_link', { argument: x.get('name').toLowerCase() }));
								});
							})
						});

					return Promise.each(promiseChain, (prom) => prom);
				} else if (subOpts.mode === 'graph_smart_grow') {
					let limit = 10;
					if (subOpts.aggression === 'yolo') limit = 50;
					else if (subOpts.aggression === 'fuckit') limit = 250;

					let promiseChain = [];

					graphDb.getRandomSubredditSample(limit)
						.then((subreddits) => {
							_.forEach(subreddits, (s) => {
								promiseChain.push(
									exports.runCommand('specific_subreddit', { argument: s.toLowerCase() })
								);
							});
						})
						.then(() => {
							graphDb.getRandomAccountSample(limit)
								.then((accounts) => {
									_.forEach(accounts, (a) => {
										promiseChain.push(
											exports.runCommand('specific_user', { argument: a.toLowerCase() })
										);
									});
								});
						})
						.then(() => {
							graphDb.getGrowthPotentialSubreddits(limit)
								.then((subreddits) => {
									_.forEach(subreddits, (s) => {
										promiseChain.push(
											exports.runCommand('specific_subreddit', { argument: s.toLowerCase() })
										);
									});
								});
						});

					return Promise.each(promiseChain, (prom) => prom);
				} else if (subOpts.mode === 'link_grow') {
					let limit = 1;
					if (subOpts.aggression === 'yolo') limit = 10;
					else if (subOpts.aggression === 'fuckit') limit = 25;

					let promiseChain = [];

					sqlDb.getLinkSample(limit)
						.then((res) => {
							_.forEach(res, (l) => {
								promiseChain.push(
									exports.runCommand('specific_link', { argument: l.toLowerCase() })
								);
							});
						});

					return Promise.each(promiseChain, (prom) => prom);
				}

				break;
			}

			case 'subreddit_evil': {
				let promiseChain = [
					exports.runCommand('specific_subreddit', { argument: opts.argument.toLowerCase() })
						.then(() => {
							exports.runCommand('grow', { subOpts: { mode: 'subreddit_stalk', aggression: 'fuckit' }, which: { which: opts.argument.toLowerCase() } })
						})
						.then(() => {
							exports.runCommand('grow', { subOpts: { mode: 'subreddit_stalk', aggression: 'fuckit' }, which: { which: opts.argument.toLowerCase() } })
						})
				];

				return Promise.each(promiseChain, (prom) => prom);
			}
		}
	};
})();