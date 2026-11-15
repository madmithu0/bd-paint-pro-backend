module.exports = {
  apps: [
    {
      name: 'enterprise-paint-v3',
      script: './server/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1024M', // Auto-restart if RAM exceeds 1GB
      min_uptime: '5s',
      max_restarts: 15,
      restart_delay: 500, // Crash recovery in < 1 second
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 10000,
      node_args: '--expose-gc',
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        APP_VERSION: 'v3.0.0',
      },
    },
  ],
};
