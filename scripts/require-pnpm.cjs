if (!process.env.npm_config_user_agent?.startsWith('pnpm/')) {
  console.error('Use pnpm para instalar este workspace.');
  process.exit(1);
}
