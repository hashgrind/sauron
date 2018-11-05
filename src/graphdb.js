(function () {
	'use strict';

	const path = require('path'),
		Promise = require('bluebird'),
		_ = require('lodash');

	const conf = require(path.join(require('app-root-path').toString(), 'src', 'config', 'config.js')).get();

	exports.neo4j = require('neo4j-driver').v1;

	exports.driver = exports.neo4j.driver('bolt://' + conf.neo4jHost + ':' + conf.neo4jPort, exports.neo4j.auth.basic(conf.neo4jUser, conf.neo4jPassword));

	exports.session = exports.driver.session();

	async function sessionBoundCypher(statement, parameters) {
		return exports.session.run(statement, parameters);
	}

	exports.getDirectedRelationship = async function (node1Name, node1Color, type, node2Name, node2Color) {
		return sessionBoundCypher("match (a:" + node1Color + " { name: $name1 })-[r:" + type + "]->(b:" + node2Color + " { name: $name2 }) return r", { name1: node1Name, name2: node2Name });
	};

	exports.createDirectedRelationship = async function (node1Name, node1Color, type, node2Name, node2Color) {
		return sessionBoundCypher("match (a:" + node1Color + " { name: $name1 }), (b:" + node2Color + " { name: $name2 }) create (a)-[r:" + type + "]->(b) return r", { name1: node1Name, name2: node2Name });
	};

	exports.getOrCreateDirectedRelationship = async function (node1Name, node1Color, type, node2Name, node2Color) {
		return exports.getDirectedRelationship(node1Name, node1Color, type, node2Name, node2Color)
			.then((results) => {
				if (results && results.records && results.records.length > 0) {
					return results.records[0];
				} else {
					if (conf.verbose) console.log("[+] (a:" + node1Color + " { name: " + node1Name + " })-[:" + type + "]->(b:" + node2Color + " { name: " + node2Name + " })");
					return exports.createDirectedRelationship(node1Name, node1Color, type, node2Name, node2Color);
				}
			});
	};

	exports.getAccount = async function (account) {
		if (conf.debug) console.debug('Getting account ' + account);

		return sessionBoundCypher("match (a:Account { name: $name }) return a", { name: account });
	};

	exports.createAccount = async function (account) {
		if (conf.debug) console.debug('Creating account ' + account);

		return sessionBoundCypher("merge (a:Account { name: $name }) return a", { name: account });
	};

	exports.getOrCreateAccount = async function (account) {
		if (account === '[deleted]' || account === 'automoderator') return Promise.resolve();

		return exports.getAccount(account)
			.then((results) => {
				if (results && results.records && results.records.length > 0) {
					return results.records[0];
				} else {
					if (conf.verbose) console.log("[+] Account " + account);
					return exports.createAccount(account);
				}
			})
	};

	exports.getSubreddit = async function (subreddit) {
		if (conf.debug) console.debug('Getting subreddit ' + subreddit);

		return sessionBoundCypher("match (s:Subreddit { name: $name }) return s", { name: subreddit });
	};

	exports.createSubreddit = async function (subreddit) {
		if (conf.debug) console.debug('Creating subreddit ' + subreddit);

		return sessionBoundCypher("merge (s:Subreddit { name: $name }) return s", { name: subreddit });
	};

	exports.getOrCreateSubreddit = async function (subreddit) {
		return exports.getSubreddit(subreddit)
			.then((results) => {
				if (results && results.records && results.records.length > 0) {
					return results.records[0];
				} else {
					if (conf.verbose) console.log("[+] Subreddit " + subreddit);
					return exports.createSubreddit(subreddit);
				}
			})
	};

	exports.getAccountsNearSubreddit = async function (subreddit, limit) {
		return sessionBoundCypher("match (s:Subreddit { name: $name })--(a:Account) return distinct a order by randomUUID() limit $limit", { name: subreddit, limit: limit })
			.then((results) => {
				if (results && results.records && results.records.length > 0) {
					return _.map(results.records, (rec) => rec.get(0).properties.name);
				} else return Promise.resolve();
			})
	};

	exports.getSubredditsNearAccount = async function (account, limit) {
		return sessionBoundCypher("match (s:Subreddit)--(a:Account { name: $name }) return distinct s order by randomUUID() limit $limit", { name: account, limit: limit })
			.then((results) => {
				if (results && results.records && results.records.length > 0) {
					return _.map(results.records, (rec) => rec.get(0).properties.name);
				} else return Promise.resolve();
			})
	};

	exports.getSubredditsNearSubreddit = async function (subreddit, limit) {
		return sessionBoundCypher("match (s:Subreddit { name: $name })--(a:Account)--(s2:Subreddit) where s2 <> s return s2.name as name order by randomUUID() limit $limit", { name: subreddit, limit: limit })
			.then((results) => {
				if (results && results.records && results.records.length > 0) {
					return _.map(results.records, (rec) => rec.get('name'));
				} else return Promise.resolve();
			})
	};

	exports.getRandomSharedInterestSubredditsNearSubreddit = async function (subreddit, limit) {
		return sessionBoundCypher("match (s0:Subreddit {name: $name})--(a:Account)--(s1:Subreddit) where s0 <> s1 with distinct a.name as account, s1.name as sub with sub, collect(account) as accounts with sub, accounts, size(accounts) as numAccounts where not sub in [ 'askreddit', 'announcements', 'funny', 'pics', 'todayilearned', 'science', 'iama', 'blog', 'videos', 'worldnews', 'gaming', 'movies', 'music', 'aww', 'news', 'gifs', 'askscience', 'explainlikeimfive', 'earthporn', 'books', 'television', 'lifeprotips', 'sports', 'diy', 'showerthoughts', 'space', 'jokes', 'tifu', 'food', 'photoshopbattles', 'art', 'internetisbeautiful', 'mildlyinteresting', 'getmotivated', 'history', 'nottheonion', 'gadgets', 'dataisbeautiful', 'futurology', 'documentaries', 'listentothis', 'personalfinance', 'philosophy', 'nosleep', 'creepy', 'oldschoolcool', 'upliftingnews', 'writingprompts', 'twoxchromosomes'] and numAccounts > 1 return sub order by randomUUID() limit $limit", { name: subreddit, limit: limit })
			.then((results) => {
				if (results && results.records && results.records.length > 0) {
					return _.map(results.records, (rec) => rec.get('sub'));
				} else return Promise.resolve();
			})
	};

	exports.getGrowthPotentialSubreddits = async function (limit) {
		return sessionBoundCypher("match (s:Subreddit)--(a:Account)--(s2:Subreddit) where s2 <> s with s.name as subreddit, count(distinct s2) as subsReached, count(distinct a) as accounts with subreddit, subsReached, accounts, toFloat(subsReached)/toFloat(accounts) as reachRatio where accounts > 0 return subreddit as name order by reachRatio desc, subsReached desc, accounts desc limit $limit", { limit: limit })
			.then((results) => {
				if (results && results.records && results.records.length > 0) {
					return _.map(results.records, (rec) => {return rec.get('name');});
				} else return Promise.resolve();
			})
	};

	exports.getRandomSubredditSample = async function (limit) {
		return sessionBoundCypher("match (s:Subreddit) return s.name as name order by randomUUID() limit $limit", { limit: limit })
			.then((results) => {
				if (results && results.records && results.records.length > 0) {
					return _.map(results.records, (rec) => {return rec.get('name');});
				} else return Promise.resolve();
			})
	};

	exports.getRandomAccountSample = async function (limit) {
		return sessionBoundCypher("match (a:Account) return a.name as name order by randomUUID() limit $limit", { limit: limit })
			.then((results) => {
				if (results && results.records && results.records.length > 0) {
					return _.map(results.records, (rec) => {return rec.get('name');});
				} else return Promise.resolve();
			})
	};
})();