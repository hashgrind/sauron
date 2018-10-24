(function () {
	'use strict';

	const fs = require('fs'),
		path = require('path');

	const configFilePath = path.join(require('app-root-path').toString(),  'src', 'config', 'config.json');

	exports.get =  () => {
		return JSON.parse(fs.readFileSync(configFilePath));
	};

	exports.update =  (obj) => {
		fs.writeFileSync(configFilePath, JSON.stringify(obj));
	};
})();