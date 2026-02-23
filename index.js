module.exports = async (req, res) => {
  const DISCORD_CLIENT_ID     = (process.env.DISCORD_CLIENT_ID     || '').trim();
  const DISCORD_CLIENT_SECRET = (process.env.DISCORD_CLIENT_SECRET || '').trim();
  const DISCORD_REDIRECT_URI  = (process.env.DISCORD_REDIRECT_URI  || '').trim();
  const MAIN_SITE             = (process.env.MAIN_SITE             || 'https://vltx-adoe.onrender.com').trim();

  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/auth/discord') {
    const redirect = url.searchParams.get('redirect') || '/customize';
    const params = new URLSearchParams({
      client_id:     DISCORD_CLIENT_ID,
      redirect_uri:  DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope:         'identify',
      state:         redirect,
    });
    res.writeHead(302, { Location: `https://discord.com/oauth2/authorize?${params}` });
    return res.end();
  }

  if (pathname === '/auth/discord/callback') {
    const code  = url.searchParams.get('code');
    const state = url.searchParams.get('state') || '/customize';

    if (!code) {
      res.writeHead(302, { Location: `${MAIN_SITE}/customize?discord_error=no_code` });
      return res.end();
    }

    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type:    'authorization_code',
          code,
          redirect_uri:  DISCORD_REDIRECT_URI,
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const user = await userRes.json();

      const hash = user.avatar;
      const avatarUrl = hash
        ? `https://cdn.discordapp.com/avatars/${user.id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) >> 22n) % 6}.png`;

      const returnTo = state.startsWith('/') ? state : '/customize';
      const params = new URLSearchParams({
        discord_id:       user.id,
        discord_username: user.global_name || user.username,
        discord_avatar:   avatarUrl,
        discord_tag:      user.discriminator && user.discriminator !== '0'
          ? `#${user.discriminator}` : `@${user.username}`,
      });

      res.writeHead(302, { Location: `${MAIN_SITE}${returnTo}?${params}` });
      return res.end();

    } catch (e) {
      console.error('Discord OAuth error:', e.message);
      res.writeHead(302, { Location: `${MAIN_SITE}/customize?discord_error=${encodeURIComponent(e.message)}` });
      return res.end();
    }
  }

  res.writeHead(404);
  res.end('Not found');
};
