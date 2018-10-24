(async function () {
	'use strict';

	const path = require('path'),
		prompts = require('prompts');

	const sqlDb = require(path.join(require('app-root-path').toString(), 'src', 'sqldb.js')),
		commandHandler = require(path.join(require('app-root-path').toString(), 'src', 'commandHandler.js')),
		graphDb = require(path.join(require('app-root-path').toString(), 'src', 'graphdb.js'));

	async function mainMenu() {
		return prompts([
			{
				type: 'select',
				name: 'ingestAction',
				message: 'What would you like to do?',
				choices: [
					{ title: 'Add User', value: { command: 'specific_user' } },
					{ title: 'Add Subreddit', value: { command: 'specific_subreddit' } },
					{ title: 'Add Link', value: { command: 'specific_link' } },
					{ title: 'Add Subreddit and Grow', value: { command: 'subreddit_evil' } },
					{ title: 'Grow Graph', value: { command: 'grow' } },
					{ title: 'Exit', value: { command: 'exit' } }
				],
				initial: 3
			},
			{
				type: prev => ['specific_user', 'specific_subreddit', 'specific_link', 'specific_message', 'subreddit_evil'].indexOf(prev.command) > -1 ? 'text' : null,
				name: 'ingestSource',
				message: 'Which one?'
			}
		]);
	}

	async function getMainMenuResponse () {
		let mainMenuResponse = await mainMenu();
		if (mainMenuResponse.ingestAction.command === 'exit') process.exit(0);

		return commandHandler.runCommand(mainMenuResponse.ingestAction.command, mainMenuResponse.ingestSource ? { argument: mainMenuResponse.ingestSource.toLowerCase() } : null)
			.then(() => { return getMainMenuResponse(); });
	}

	// Handle death
	process.on('exit', () => { graphDb.session.close(); graphDb.driver.close(); process.exit(0); });
	process.on('SIGINT', () => { graphDb.session.close(); graphDb.driver.close(); process.exit(0); });
	process.on('SIGUSR1', () => { graphDb.session.close(); graphDb.driver.close(); process.exit(20); });
	process.on('SIGUSR2', () => { graphDb.session.close(); graphDb.driver.close(); process.exit(25); });
	process.on('uncaughtException', () => { graphDb.session.close(); graphDb.driver.close(); process.exit(100); });

	sqlDb.checkCreateDb()
		.then(() => { return getMainMenuResponse() })
		.catch(console.error);
})();