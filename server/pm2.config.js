export default {
  apps: [
    {
      name: 'bd-paint-pro-server',
      script: './server/server.js',
      exec_mode: 'cluster',
      instances: 'max',
      watch: true,
      autorestart: true,
      max_restarts: 100,
      restart_delay: 2000,
      env: { NODE_ENV: 'production' },
    },
  ],
};
