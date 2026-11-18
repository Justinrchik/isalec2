'use strict';

const teamId = process.env.TEAM_ID || 'prjD6';

module.exports = Object.freeze({
  teamId,
  basePath: `/${teamId}`,
  adminUsername: 'admin',
  // Change these environment values during Phase 2, then restart only once.
  adminPassword: process.env.ADMIN_PASSWORD || 'BCIT12',
  displayedSecret: process.env.APP_SECRET_VALUE || 'defaultSecret',
  // Set a long random value in the deployment host. The fallback is local-development only.
  jwtSigningKey: process.env.JWT_SIGNING_KEY || 'local-development-only-change-this-key',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:8080',
  jwtLifetimeSeconds: 60 * 60 * 2 + 60 * 30,
  port: Number(process.env.PORT || 3001),
  httpsKeyFile: process.env.HTTPS_KEY_FILE,
  httpsCertFile: process.env.HTTPS_CERT_FILE
});

