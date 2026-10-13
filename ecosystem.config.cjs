module.exports = {
  apps: [
    {
      name: 'repolens',
      script: 'server/server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx/esm',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
