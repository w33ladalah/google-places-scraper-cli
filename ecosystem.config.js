module.exports = {
  apps : [
      {
      name: 'gmap-scraper-1',
      script: 'babel-output/index.js',
      args: "--scraper=1 --city=\"Akaa\" --category=\"Association or organization\"",
      watch: ['babel-output'],
      // Specify delay between watch interval
      watch_delay: 500,
      // Specify which folder to ignore
      ignore_watch: ["node_modules", "src"],
      max_memory_restart: '1000M',
      restart_delay: 4000,
      listen_timeout: 5000,
      error_file: 'logs/gmap-1-error.log',
      out_file: 'logs/gmap-1-out.log',
    }, {
      name: 'gmap-scraper-2',
      script: 'babel-output/index.js',
      args: "--scraper=2 --city=\"Lapua\" --category=\"Association or organization\"",
      watch: ['babel-output'],
      // Specify delay between watch interval
      watch_delay: 500,
      // Specify which folder to ignore
      ignore_watch: ["node_modules", "src"],
      max_memory_restart: '1000M',
      restart_delay: 4000,
      listen_timeout: 5000,
      error_file: 'logs/gmap-2-error.log',
      out_file: 'logs/gmap-2-out.log',
    }
  ]
};
