module.exports = {
  apps : [{
    name: 'gmap-scraper',
    script: 'babel-output/index.js',
    watch: ['babel-output'],
    // Specify delay between watch interval
    watch_delay: 500,
    // Specify which folder to ignore
    ignore_watch: ["node_modules", "src"],
    max_memory_restart: '2G',
    restart_delay: 4000,
    listen_timeout: 5000,
    error_file: 'logs/gmap-error.log',
    out_file: 'logs/gmap-out.log',
  }]
};
