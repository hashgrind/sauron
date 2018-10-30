# sauron

Sauron is a graph data ingestion tool designed for social engineering and casual mass surveillance. It is very much still in development.

## Installation

1. Set up a neo4j server
2. `npm install`
3. Edit `src/config/config.json`
4. `node sauron.js`

## Tips

Run `create index on :Account(name)` and `create index on :Subreddit(name)` to speed neo4j up. At some point we'll just do this for you.

## TODO

* Console output + prompts display conflict cleanup
* Automatically apply graph indexes
* Cypher query generator
* Do even more with the Reddit data we get
* Expand beyond Reddit to include other delicious data trails
* Handle failure on nonexistent subreddits being entered
* Restructure application to suck less and be maintainable

## Interesting Queries

TODO/try harder ;)

## License

MIT